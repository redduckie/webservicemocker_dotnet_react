-- Normalize application entities, but keep captured HTTP logs as whole documents.
-- Request/response body strings retain JSON formatting, XML, form data, and truncation markers.
alter table mockingbird.request_logs add column data jsonb;
update mockingbird.request_logs l set data=mockingbird.log_document(l);
alter table mockingbird.request_logs alter column data set not null;
create or replace function mockingbird.log_document(l mockingbird.request_logs) returns jsonb
language sql stable set search_path='' as $$
  select l.data || jsonb_build_object('id',l.id,'projectId',l.project_id);
$$;
drop table mockingbird.log_request_headers;
alter table mockingbird.request_logs
  drop column timestamp, drop column operation_name, drop column endpoint_id,
  drop column method, drop column path, drop column request_body,
  drop column request_body_size_bytes, drop column request_body_truncated,
  drop column response_body, drop column matched, drop column status_code, drop column headers_present;
create or replace function public.mockingbird_store(action text,args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare doc jsonb; item jsonb; result jsonb; n integer; affected integer; retention integer; page_size integer; pos integer;
begin
case action
when 'project_get' then
  if args ? 'endpointId' then
    select mockingbird.project_document(p) || jsonb_build_object('endpoints',coalesce((select jsonb_agg(mockingbird.endpoint_document(e)) from mockingbird.rest_endpoints e where e.project_id=p.id and e.id=args->>'endpointId'),'[]'::jsonb)) into result from mockingbird.projects p where kind='rest' and id=args->>'id';
  else
    select mockingbird.project_document(p) into result from mockingbird.projects p where kind=args->>'kind' and id=args->>'id';
  end if;
when 'project_list' then
  select coalesce(jsonb_agg(mockingbird.project_document(p) order by p.created_at,p.id),'[]'::jsonb) into result from mockingbird.projects p where kind=args->>'kind' and owner=args->>'owner';
when 'project_save' then
  doc:=args->'project';
  if coalesce(doc->>'sessionToken','')='' then raise exception 'Missing project owner'; end if;
  if coalesce((args->>'create')::boolean,false) then
    insert into mockingbird.projects(kind,owner,enabled,id,name,created_at,mock_url,mock_base_url,wsdl_content) values(args->>'kind',doc->>'sessionToken',coalesce((doc->>'enabled')::boolean,false),(doc->>'id')::text,(doc->>'name')::text,(doc->>'createdAt')::text,(doc->>'mockUrl')::text,(doc->>'mockBaseUrl')::text,(doc->>'wsdlContent')::text);
    pos:=0;
    if args->>'kind'='rest' then
      for item in select value from jsonb_array_elements(doc->'endpoints') loop
        perform mockingbird.write_endpoint(doc->>'id',item);
        pos:=pos+1;
        update mockingbird.rest_endpoints set position=pos where project_id=doc->>'id' and id=item->>'id';
      end loop;
    else
      for item in select value from jsonb_array_elements(doc->'operations') loop
        perform mockingbird.write_operation(doc->>'id',item);
        pos:=pos+1;
        update mockingbird.soap_operations set position=pos where project_id=doc->>'id' and name=item->>'name';
      end loop;
    end if;
  else
    update mockingbird.projects set name=(doc->>'name')::text,created_at=(doc->>'createdAt')::text,mock_url=(doc->>'mockUrl')::text,mock_base_url=(doc->>'mockBaseUrl')::text,wsdl_content=(doc->>'wsdlContent')::text where kind=args->>'kind' and id=doc->>'id' and owner=doc->>'sessionToken';
    if not found then raise exception 'Project missing or owner mismatch'; end if;
  end if;
when 'project_availability' then
  update mockingbird.projects set enabled=(args->>'enabled')::boolean where kind=args->>'kind' and id=args->>'id' and owner=args->>'owner';
  return to_jsonb(found);
when 'project_delete' then
  delete from mockingbird.projects where kind=args->>'kind' and id=args->>'id' and owner=args->>'owner'; return to_jsonb(found);
when 'project_delete_owner' then
  delete from mockingbird.projects where owner=args->>'owner';
when 'endpoint_add','endpoint_update','endpoint_delete','operation_update' then
  perform 1 from mockingbird.projects where kind=args->>'kind' and id=args->>'id' and owner=args->>'owner' for update;
  if not found then return 'false'::jsonb; end if;
  if action='endpoint_add' then
    if args->>'kind'<>'rest' then return 'false'::jsonb; end if;
    if exists(select 1 from mockingbird.rest_endpoints where project_id=args->>'id' and id=args->'endpoint'->>'id') then raise exception 'Duplicate endpoint'; end if;
    select coalesce(max(position),0)+1 into pos from mockingbird.rest_endpoints where project_id=args->>'id';
    perform mockingbird.write_endpoint(args->>'id',args->'endpoint');
    update mockingbird.rest_endpoints set position=pos where project_id=args->>'id' and id=args->'endpoint'->>'id';
  elsif action='endpoint_update' then
    select mockingbird.endpoint_document(e) into doc from mockingbird.rest_endpoints e where project_id=args->>'id' and id=args->>'endpointId' and args->>'kind'='rest';
    if not found then return 'false'::jsonb; end if;
    perform mockingbird.write_endpoint(args->>'id',doc || (args->'updates'));
  elsif action='endpoint_delete' then
    delete from mockingbird.rest_endpoints where project_id=args->>'id' and id=args->>'endpointId' and args->>'kind'='rest'; return to_jsonb(found);
  else
    select mockingbird.operation_document(o),o.position into doc,pos from mockingbird.soap_operations o where project_id=args->>'id' and name=args->>'operationName' and args->>'kind'='soap';
    if not found then return 'false'::jsonb; end if;
    if args->'updates'->>'name' <> args->>'operationName' and exists(select 1 from mockingbird.soap_operations where project_id=args->>'id' and name=args->'updates'->>'name') then raise exception 'Duplicate operation'; end if;
    delete from mockingbird.soap_operations where project_id=args->>'id' and name=args->>'operationName';
    perform mockingbird.write_operation(args->>'id',doc || (args->'updates'));
    update mockingbird.soap_operations set position=pos where project_id=args->>'id' and name=args->'updates'->>'name';
  end if;
  return 'true'::jsonb;
when 'access_save' then
  doc:=args->'user';
  insert into mockingbird.access_users(email,status,api_key,display_name,role,requested_at,reviewed_at,credential_key,has_features)
    values(doc->>'email',doc->>'status',case when doc->>'status'='approved' then doc->>'apiKey' end,doc->>'displayName',doc->>'role',doc->>'requestedAt',doc->>'reviewedAt',doc->>'apiKey',doc ? 'features')
    on conflict(email) do update set status=excluded.status,api_key=excluded.api_key,display_name=excluded.display_name,role=excluded.role,requested_at=excluded.requested_at,reviewed_at=excluded.reviewed_at,credential_key=excluded.credential_key,has_features=excluded.has_features;
  delete from mockingbird.user_features where user_email=doc->>'email';
  insert into mockingbird.user_features select doc->>'email',f.key,(f.value)::boolean from jsonb_each_text(doc->'features') f;
when 'access_get' then
  select mockingbird.user_document(u) into result from mockingbird.access_users u where email=args->>'email';
when 'access_by_key' then
  select mockingbird.user_document(u) into result from mockingbird.access_users u where api_key=args->>'apiKey' and status='approved';
when 'access_list' then
  select coalesce(jsonb_agg(mockingbird.user_document(u)),'[]'::jsonb) into result from mockingbird.access_users u where status=args->>'status';
when 'settings_get' then
  select mockingbird.settings_document(s) into result from mockingbird.settings s where id;
when 'settings_save' then
  perform mockingbird.write_settings(args->'settings');
when 'collection_list_columns' then
  select coalesce(jsonb_agg(mockingbird.collection_summary(c) order by c.updated_at desc,c.id),'[]'::jsonb) into result from mockingbird.collections c where owner=args->>'owner';
when 'collection_get_columns','collection_metadata_columns' then
  select mockingbird.collection_metadata(c) ||
    case when action='collection_get_columns' then jsonb_build_object('requests',coalesce((select jsonb_agg(mockingbird.request_document(r) order by r.position,r.id) from mockingbird.collection_requests r where r.owner=c.owner and r.collection_id=c.id),'[]'::jsonb))
    else jsonb_build_object('order',coalesce((select jsonb_agg(r.id order by r.position,r.id) from mockingbird.collection_requests r where r.owner=c.owner and r.collection_id=c.id),'[]'::jsonb)) end
    into result from mockingbird.collections c where owner=args->>'owner' and id=args->>'id';
when 'collection_save_columns' then
  doc:=args->'metadata';
  if args->>'revision'='' then
    insert into mockingbird.collections(owner,id,revision) values(args->>'owner',args->>'id',doc->>'revision') on conflict(owner,id) do nothing;
    if not found then return 'false'::jsonb; end if;
  else
    update mockingbird.collections set revision=doc->>'revision' where owner=args->>'owner' and id=args->>'id' and revision=args->>'revision';
    if not found then return 'false'::jsonb; end if;
  end if;
  update mockingbird.collections set name_encrypted=(doc->>'name')::text,mode=(doc->>'mode')::text,updated_at=(doc->>'updatedAt')::text,request_count=(doc->>'requestCount')::integer
    ,variables_present=doc ? 'variables',sensitive_present=doc ? 'sensitiveVariables' where owner=args->>'owner' and id=args->>'id';
  delete from mockingbird.collection_variables where owner=args->>'owner' and collection_id=args->>'id';
  insert into mockingbird.collection_variables select args->>'owner',args->>'id',v.ordinality::integer,v.value->>'name',v.value->>'value' from jsonb_array_elements(doc->'variables') with ordinality v;
  delete from mockingbird.collection_sensitive_variables where owner=args->>'owner' and collection_id=args->>'id';
  insert into mockingbird.collection_sensitive_variables select args->>'owner',args->>'id',v.ordinality::integer,v.value from jsonb_array_elements_text(doc->'sensitiveVariables') with ordinality v;
  for item in select value from jsonb_array_elements(args->'requests') loop
    perform mockingbird.write_request(args->>'owner',args->>'id',item);
  end loop;
  delete from mockingbird.collection_requests where owner=args->>'owner' and collection_id=args->>'id' and not (args->'order' ? id);
  update mockingbird.collection_requests r set position=e.ordinality::integer from jsonb_array_elements_text(args->'order') with ordinality e where r.owner=args->>'owner' and r.collection_id=args->>'id' and r.id=e.value and r.position<>e.ordinality;
  select count(*) into n from mockingbird.collection_requests where owner=args->>'owner' and collection_id=args->>'id';
  if n<>jsonb_array_length(args->'order') or n<>(doc->>'requestCount')::integer then raise exception 'Invalid request references'; end if;
  return 'true'::jsonb;
when 'collection_delete' then
  delete from mockingbird.collections where owner=args->>'owner' and id=args->>'id' and revision=args->>'revision'; return to_jsonb(found);
when 'collection_get','collection_save','collection_get_rows','collection_get_metadata','collection_save_rows','collection_list' then
  raise exception 'Legacy collection API retired; reload the application';
when 'rate_increment' then
  delete from mockingbird.rate_windows where minute < floor(extract(epoch from now())/60)::bigint-2;
  insert into mockingbird.rate_windows(identity,minute,count) values(args->>'identity',(args->>'minute')::bigint,1) on conflict(identity,minute) do update set count=mockingbird.rate_windows.count+1 returning count into n;
  return to_jsonb(n);
when 'log_add' then
  doc:=args->'log'; n:=greatest(10,least(500,(args->>'maxLogs')::integer)); retention:=greatest(1,least(30,(args->>'retentionDays')::integer));
  perform 1 from mockingbird.projects where kind=args->>'kind' and id=doc->>'projectId' for update;
  if not found then return 'null'::jsonb; end if;
  delete from mockingbird.request_logs where expires_at<=now();
  insert into mockingbird.request_logs(kind,project_id,id,recorded_at,expires_at,data)
    values(args->>'kind',doc->>'projectId',doc->>'id',(doc->>'timestamp')::timestamptz,(doc->>'timestamp')::timestamptz+make_interval(days=>retention),doc)
    on conflict(kind,project_id,id) do update set data=excluded.data,recorded_at=excluded.recorded_at,expires_at=excluded.expires_at;
  delete from mockingbird.request_logs where kind=args->>'kind' and project_id=doc->>'projectId' and
    (recorded_at<=now()-make_interval(days=>retention) or id in
      (select id from mockingbird.request_logs where kind=args->>'kind' and project_id=doc->>'projectId' order by recorded_at desc,id offset n));
when 'log_list' then
  page_size:=greatest(1,least(500,(args->>'pageSize')::integer));
  select jsonb_build_object('total',count(*),'logs',coalesce((select jsonb_agg(mockingbird.log_document(page) order by page.recorded_at desc,page.id) from (select * from mockingbird.request_logs where kind=args->>'kind' and project_id=args->>'projectId' and expires_at>now() order by recorded_at desc,id limit page_size offset (greatest(1,(args->>'page')::integer)-1)*page_size) page),'[]'::jsonb)) into result from mockingbird.request_logs where kind=args->>'kind' and project_id=args->>'projectId' and expires_at>now();
when 'logs_purge_count' then
  select to_jsonb(count(*)) into result from mockingbird.request_logs;
when 'logs_purge' then
  delete from mockingbird.request_logs; get diagnostics affected=row_count; return to_jsonb(affected);
when 'cleanup' then
  delete from mockingbird.request_logs where expires_at<=now();
  delete from mockingbird.rate_windows where minute < floor(extract(epoch from now())/60)::bigint-2;
else raise exception 'Unknown storage action';
end case;
return coalesce(result,'null'::jsonb);
end;
$$;


