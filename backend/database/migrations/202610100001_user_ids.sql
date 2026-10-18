-- Stable UUID ownership; encryption_scope is immutable legacy AAD metadata, not a relationship key.
alter table mockingbird.access_users add column id uuid not null default gen_random_uuid();
do $$ declare c record; begin
  for c in select conrelid::regclass as tbl,conname from pg_constraint where contype='f' and conrelid in
    ('mockingbird.projects'::regclass,'mockingbird.collections'::regclass,'mockingbird.collection_requests'::regclass,
     'mockingbird.collection_variables'::regclass,'mockingbird.collection_sensitive_variables'::regclass,
     'mockingbird.collection_request_headers'::regclass,'mockingbird.collection_request_operations'::regclass,'mockingbird.user_features'::regclass)
  loop execute format('alter table %s drop constraint %I',c.tbl,c.conname); end loop;
end $$;
alter table mockingbird.access_users rename column collection_scope to encryption_scope;
alter table mockingbird.access_users alter column encryption_scope drop expression;
alter table mockingbird.access_users add constraint access_users_email_unique unique(email);
alter table mockingbird.access_users drop constraint access_users_pkey;
alter table mockingbird.access_users add primary key(id);
create function mockingbird.owner_uuid(value text) returns uuid language sql stable set search_path='' as $$
  select id from mockingbird.access_users where id::text=value or email=value or encryption_scope=value;
$$;
revoke all on function mockingbird.owner_uuid(text) from public,anon,authenticated,service_role;
alter table mockingbird.projects alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collections alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collection_requests alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collection_variables alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collection_sensitive_variables alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collection_request_headers alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.collection_request_operations alter column owner type uuid using mockingbird.owner_uuid(owner);
alter table mockingbird.user_features add column user_id uuid;
update mockingbird.user_features set user_id=mockingbird.owner_uuid(user_email);
alter table mockingbird.user_features alter column user_id set not null;
alter table mockingbird.user_features drop constraint user_features_pkey;
alter table mockingbird.user_features drop column user_email;
alter table mockingbird.user_features add primary key(user_id,feature);
alter table mockingbird.user_features add foreign key(user_id) references mockingbird.access_users(id) on delete cascade;
alter table mockingbird.projects add foreign key(owner) references mockingbird.access_users(id);
alter table mockingbird.collections add foreign key(owner) references mockingbird.access_users(id);
alter table mockingbird.collection_requests add foreign key(owner,collection_id) references mockingbird.collections(owner,id) on delete cascade;
alter table mockingbird.collection_variables add foreign key(owner,collection_id) references mockingbird.collections(owner,id) on delete cascade;
alter table mockingbird.collection_sensitive_variables add foreign key(owner,collection_id) references mockingbird.collections(owner,id) on delete cascade;
alter table mockingbird.collection_request_headers add foreign key(owner,collection_id,request_id) references mockingbird.collection_requests(owner,collection_id,id) on delete cascade;
alter table mockingbird.collection_request_operations add foreign key(owner,collection_id,request_id) references mockingbird.collection_requests(owner,collection_id,id) on delete cascade;
create or replace function mockingbird.project_document(p mockingbird.projects) returns jsonb language sql stable set search_path='' as $$
select jsonb_strip_nulls(jsonb_build_object('id',p.id,'name',p.name,'createdAt',p.created_at,'mockUrl',p.mock_url,'mockBaseUrl',p.mock_base_url,'wsdlContent',p.wsdl_content))
|| jsonb_build_object('sessionToken',(select email from mockingbird.access_users where id=p.owner),'enabled',p.enabled)
|| case when p.kind='rest' then jsonb_build_object('endpoints',coalesce((select jsonb_agg(mockingbird.endpoint_document(e) order by e.position,e.id) from mockingbird.rest_endpoints e where e.project_id=p.id),'[]'::jsonb))
else jsonb_build_object('operations',coalesce((select jsonb_agg(mockingbird.operation_document(o) order by o.position,o.name) from mockingbird.soap_operations o where o.project_id=p.id),'[]'::jsonb)) end;
$$;
create or replace function mockingbird.user_document(u mockingbird.access_users) returns jsonb language sql stable set search_path='' as $$
select jsonb_strip_nulls(jsonb_build_object('email',u.email,'status',u.status,'displayName',u.display_name,'role',u.role,'requestedAt',u.requested_at,'reviewedAt',u.reviewed_at,'apiKey',u.credential_key))
|| case when u.has_features then jsonb_build_object('features',coalesce((select jsonb_object_agg(f.feature,f.enabled) from mockingbird.user_features f where f.user_id=u.id),'{}'::jsonb)) else '{}'::jsonb end;
$$;
create or replace function mockingbird.write_request(p_owner text, p_collection_id text, doc jsonb) returns void language plpgsql set search_path='' as $$ begin
insert into mockingbird.collection_requests(owner,collection_id,id,mode,method,auth_type,name_encrypted,url_encrypted,body_encrypted,token_encrypted,username_encrypted,password_encrypted,api_key_name_encrypted,wsdl_url_encrypted,wsdl_name_encrypted,selected_operation_encrypted,pre_request_script_encrypted,post_response_script_encrypted) values(p_owner::uuid,p_collection_id,(doc->>'id')::text,(doc->>'mode')::text,(doc->>'method')::text,(doc->>'authType')::text,(doc->>'name')::text,(doc->>'url')::text,(doc->>'body')::text,(doc->>'token')::text,(doc->>'username')::text,(doc->>'password')::text,(doc->>'apiKeyName')::text,(doc->>'wsdlUrl')::text,(doc->>'wsdlName')::text,(doc->>'selectedOperation')::text,(doc->>'preRequestScript')::text,(doc->>'postResponseScript')::text) on conflict(owner,collection_id,id) do update set mode=excluded.mode,method=excluded.method,auth_type=excluded.auth_type,name_encrypted=excluded.name_encrypted,url_encrypted=excluded.url_encrypted,body_encrypted=excluded.body_encrypted,token_encrypted=excluded.token_encrypted,username_encrypted=excluded.username_encrypted,password_encrypted=excluded.password_encrypted,api_key_name_encrypted=excluded.api_key_name_encrypted,wsdl_url_encrypted=excluded.wsdl_url_encrypted,wsdl_name_encrypted=excluded.wsdl_name_encrypted,selected_operation_encrypted=excluded.selected_operation_encrypted,pre_request_script_encrypted=excluded.pre_request_script_encrypted,post_response_script_encrypted=excluded.post_response_script_encrypted;
update mockingbird.collection_requests set headers_present=doc ? 'headers',operations_present=doc ? 'operations' where owner=p_owner::uuid and collection_id=p_collection_id and id=doc->>'id';
delete from mockingbird.collection_request_headers where owner=p_owner::uuid and collection_id=p_collection_id and request_id=doc->>'id';
insert into mockingbird.collection_request_headers select p_owner::uuid,p_collection_id,doc->>'id',h.ordinality::integer,(h.value->>'id')::integer,h.value->>'name',h.value->>'value' from jsonb_array_elements(doc->'headers') with ordinality h;
delete from mockingbird.collection_request_operations where owner=p_owner::uuid and collection_id=p_collection_id and request_id=doc->>'id';
insert into mockingbird.collection_request_operations select p_owner::uuid,p_collection_id,doc->>'id',h.ordinality::integer,h.value->>'name',h.value->>'soapAction',h.value->>'requestXml' from jsonb_array_elements(doc->'operations') with ordinality h;
end; $$;


create or replace function public.mockingbird_store(action text,args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare doc jsonb; item jsonb; result jsonb; n integer; affected integer; retention integer; page_size integer; pos integer;
begin
-- Resolve legacy email/scope inputs for compatibility with already-open clients.
if args ? 'owner' then args:=jsonb_set(args,'{owner}',coalesce(to_jsonb(mockingbird.owner_uuid(args->>'owner')::text),'null'::jsonb)); end if;
if action='project_save' then args:=jsonb_set(args,'{project,sessionToken}',coalesce(to_jsonb(mockingbird.owner_uuid(args->'project'->>'sessionToken')::text),'null'::jsonb)); end if;
case action
when 'collection_identity' then
  select jsonb_build_object('userId',u.id,'encryptionScope',u.encryption_scope) into result from mockingbird.access_users u where u.email=args->>'email';
when 'project_get' then
  if args ? 'endpointId' then
    select mockingbird.project_document(p) || jsonb_build_object('endpoints',coalesce((select jsonb_agg(mockingbird.endpoint_document(e)) from mockingbird.rest_endpoints e where e.project_id=p.id and e.id=args->>'endpointId'),'[]'::jsonb)) into result from mockingbird.projects p where kind='rest' and id=args->>'id';
  else
    select mockingbird.project_document(p) into result from mockingbird.projects p where kind=args->>'kind' and id=args->>'id';
  end if;
when 'project_list' then
  select coalesce(jsonb_agg(mockingbird.project_document(p) order by p.created_at,p.id),'[]'::jsonb) into result from mockingbird.projects p where kind=args->>'kind' and owner=(args->>'owner')::uuid;
when 'project_save' then
  doc:=args->'project';
  if doc->>'sessionToken' is null then raise exception 'Missing project owner'; end if;
  if coalesce((args->>'create')::boolean,false) then
    insert into mockingbird.projects(kind,owner,enabled,id,name,created_at,mock_url,mock_base_url,wsdl_content) values(args->>'kind',(doc->>'sessionToken')::uuid,coalesce((doc->>'enabled')::boolean,false),(doc->>'id')::text,(doc->>'name')::text,(doc->>'createdAt')::text,(doc->>'mockUrl')::text,(doc->>'mockBaseUrl')::text,(doc->>'wsdlContent')::text);
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
    update mockingbird.projects set name=(doc->>'name')::text,created_at=(doc->>'createdAt')::text,mock_url=(doc->>'mockUrl')::text,mock_base_url=(doc->>'mockBaseUrl')::text,wsdl_content=(doc->>'wsdlContent')::text where kind=args->>'kind' and id=doc->>'id' and owner=(doc->>'sessionToken')::uuid;
    if not found then raise exception 'Project missing or owner mismatch'; end if;
  end if;
when 'project_availability' then
  update mockingbird.projects set enabled=(args->>'enabled')::boolean where kind=args->>'kind' and id=args->>'id' and owner=(args->>'owner')::uuid;
  return to_jsonb(found);
when 'project_delete' then
  delete from mockingbird.projects where kind=args->>'kind' and id=args->>'id' and owner=(args->>'owner')::uuid; return to_jsonb(found);
when 'project_delete_owner' then
  delete from mockingbird.projects where owner=(args->>'owner')::uuid;
when 'endpoint_add','endpoint_update','endpoint_delete','operation_update' then
  perform 1 from mockingbird.projects where kind=args->>'kind' and id=args->>'id' and owner=(args->>'owner')::uuid for update;
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
  insert into mockingbird.access_users(email,status,api_key,display_name,role,requested_at,reviewed_at,credential_key,has_features,encryption_scope)
    values(doc->>'email',doc->>'status',case when doc->>'status'='approved' then doc->>'apiKey' end,doc->>'displayName',doc->>'role',doc->>'requestedAt',doc->>'reviewedAt',doc->>'apiKey',doc ? 'features',mockingbird.collection_scope(doc->>'email'))
    on conflict(email) do update set status=excluded.status,api_key=excluded.api_key,display_name=excluded.display_name,role=excluded.role,requested_at=excluded.requested_at,reviewed_at=excluded.reviewed_at,credential_key=excluded.credential_key,has_features=excluded.has_features;
  delete from mockingbird.user_features where user_id=(select id from mockingbird.access_users where email=doc->>'email');
  insert into mockingbird.user_features(user_id,feature,enabled) select (select id from mockingbird.access_users where email=doc->>'email'),f.key,(f.value)::boolean from jsonb_each_text(doc->'features') f;
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
  select coalesce(jsonb_agg(mockingbird.collection_summary(c) order by c.updated_at desc,c.id),'[]'::jsonb) into result from mockingbird.collections c where owner=(args->>'owner')::uuid;
when 'collection_get_columns','collection_metadata_columns' then
  select mockingbird.collection_metadata(c) ||
    case when action='collection_get_columns' then jsonb_build_object('requests',coalesce((select jsonb_agg(mockingbird.request_document(r) order by r.position,r.id) from mockingbird.collection_requests r where r.owner=c.owner and r.collection_id=c.id),'[]'::jsonb))
    else jsonb_build_object('order',coalesce((select jsonb_agg(r.id order by r.position,r.id) from mockingbird.collection_requests r where r.owner=c.owner and r.collection_id=c.id),'[]'::jsonb)) end
    into result from mockingbird.collections c where owner=(args->>'owner')::uuid and id=args->>'id';
when 'collection_save_columns' then
  doc:=args->'metadata';
  if args->>'revision'='' then
    insert into mockingbird.collections(owner,id,revision) values((args->>'owner')::uuid,args->>'id',doc->>'revision') on conflict(owner,id) do nothing;
    if not found then return 'false'::jsonb; end if;
  else
    update mockingbird.collections set revision=doc->>'revision' where owner=(args->>'owner')::uuid and id=args->>'id' and revision=args->>'revision';
    if not found then return 'false'::jsonb; end if;
  end if;
  update mockingbird.collections set name_encrypted=(doc->>'name')::text,mode=(doc->>'mode')::text,updated_at=(doc->>'updatedAt')::text,request_count=(doc->>'requestCount')::integer
    ,variables_present=doc ? 'variables',sensitive_present=doc ? 'sensitiveVariables' where owner=(args->>'owner')::uuid and id=args->>'id';
  delete from mockingbird.collection_variables where owner=(args->>'owner')::uuid and collection_id=args->>'id';
  insert into mockingbird.collection_variables select (args->>'owner')::uuid,args->>'id',v.ordinality::integer,v.value->>'name',v.value->>'value' from jsonb_array_elements(doc->'variables') with ordinality v;
  delete from mockingbird.collection_sensitive_variables where owner=(args->>'owner')::uuid and collection_id=args->>'id';
  insert into mockingbird.collection_sensitive_variables select (args->>'owner')::uuid,args->>'id',v.ordinality::integer,v.value from jsonb_array_elements_text(doc->'sensitiveVariables') with ordinality v;
  for item in select value from jsonb_array_elements(args->'requests') loop
    perform mockingbird.write_request(args->>'owner',args->>'id',item);
  end loop;
  delete from mockingbird.collection_requests where owner=(args->>'owner')::uuid and collection_id=args->>'id' and not (args->'order' ? id);
  update mockingbird.collection_requests r set position=e.ordinality::integer from jsonb_array_elements_text(args->'order') with ordinality e where r.owner=(args->>'owner')::uuid and r.collection_id=args->>'id' and r.id=e.value and r.position<>e.ordinality;
  select count(*) into n from mockingbird.collection_requests where owner=(args->>'owner')::uuid and collection_id=args->>'id';
  if n<>jsonb_array_length(args->'order') or n<>(doc->>'requestCount')::integer then raise exception 'Invalid request references'; end if;
  return 'true'::jsonb;
when 'collection_delete' then
  delete from mockingbird.collections where owner=(args->>'owner')::uuid and id=args->>'id' and revision=args->>'revision'; return to_jsonb(found);
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



