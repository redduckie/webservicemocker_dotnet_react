-- Fresh database only. Existing Supabase databases require the versioned migrations.
CREATE SCHEMA IF NOT EXISTS mockingbird;
CREATE FUNCTION mockingbird.collection_scope(email text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT 'mockingbird:tester:{' || encode(sha256(convert_to(email,'UTF8')),'hex') || '}:collections'; $$;
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'mockingbird') THEN
        CREATE SCHEMA mockingbird;
    END IF;
END $EF$;


CREATE TABLE mockingbird.access_users (
    id uuid NOT NULL,
    email text NOT NULL,
    status text NOT NULL,
    api_key text,
    credential_key text,
    display_name text,
    role text NOT NULL,
    requested_at text NOT NULL,
    reviewed_at text,
    has_features boolean NOT NULL,
    encryption_scope text NOT NULL,
    CONSTRAINT "PK_access_users" PRIMARY KEY (id)
);


CREATE TABLE mockingbird.rate_windows (
    identity text NOT NULL,
    minute bigint NOT NULL,
    count integer NOT NULL,
    CONSTRAINT "PK_rate_windows" PRIMARY KEY (identity, minute)
);


CREATE TABLE mockingbird.settings (
    id boolean NOT NULL,
    log_retention_days integer,
    max_logs_per_project integer,
    max_logged_request_body_mb integer,
    external_requests_enabled boolean,
    CONSTRAINT "PK_settings" PRIMARY KEY (id)
);


CREATE TABLE mockingbird.collections (
    owner uuid NOT NULL,
    id text NOT NULL,
    revision text NOT NULL,
    name_encrypted text,
    mode text,
    updated_at text,
    request_count integer,
    variables_present boolean NOT NULL,
    sensitive_present boolean NOT NULL,
    CONSTRAINT "PK_collections" PRIMARY KEY (owner, id),
    CONSTRAINT "FK_collections_access_users_owner" FOREIGN KEY (owner) REFERENCES mockingbird.access_users (id) ON DELETE RESTRICT
);


CREATE TABLE mockingbird.projects (
    kind text NOT NULL,
    id text NOT NULL,
    owner uuid NOT NULL,
    enabled boolean NOT NULL,
    name text,
    created_at text,
    mock_url text,
    mock_base_url text,
    wsdl_content text,
    CONSTRAINT "PK_projects" PRIMARY KEY (kind, id),
    CONSTRAINT "FK_projects_access_users_owner" FOREIGN KEY (owner) REFERENCES mockingbird.access_users (id) ON DELETE RESTRICT
);


CREATE TABLE mockingbird.user_features (
    user_id uuid NOT NULL,
    feature text NOT NULL,
    enabled boolean NOT NULL,
    CONSTRAINT "PK_user_features" PRIMARY KEY (user_id, feature),
    CONSTRAINT "FK_user_features_access_users_user_id" FOREIGN KEY (user_id) REFERENCES mockingbird.access_users (id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.collection_requests (
    owner uuid NOT NULL,
    collection_id text NOT NULL,
    id text NOT NULL,
    position integer NOT NULL,
    mode text,
    method text,
    auth_type text,
    name_encrypted text,
    url_encrypted text,
    body_encrypted text,
    token_encrypted text,
    username_encrypted text,
    password_encrypted text,
    api_key_name_encrypted text,
    wsdl_url_encrypted text,
    wsdl_name_encrypted text,
    selected_operation_encrypted text,
    pre_request_script_encrypted text,
    post_response_script_encrypted text,
    headers_present boolean NOT NULL,
    operations_present boolean NOT NULL,
    CONSTRAINT "PK_collection_requests" PRIMARY KEY (owner, collection_id, id),
    CONSTRAINT "FK_collection_requests_collections_owner_collection_id" FOREIGN KEY (owner, collection_id) REFERENCES mockingbird.collections (owner, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.collection_sensitive_variables (
    owner uuid NOT NULL,
    collection_id text NOT NULL,
    position integer NOT NULL,
    name_encrypted text NOT NULL,
    CONSTRAINT "PK_collection_sensitive_variables" PRIMARY KEY (owner, collection_id, position),
    CONSTRAINT "FK_collection_sensitive_variables_collections_owner_collection~" FOREIGN KEY (owner, collection_id) REFERENCES mockingbird.collections (owner, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.collection_variables (
    owner uuid NOT NULL,
    collection_id text NOT NULL,
    position integer NOT NULL,
    name_encrypted text NOT NULL,
    value_encrypted text NOT NULL,
    CONSTRAINT "PK_collection_variables" PRIMARY KEY (owner, collection_id, position),
    CONSTRAINT "FK_collection_variables_collections_owner_collection_id" FOREIGN KEY (owner, collection_id) REFERENCES mockingbird.collections (owner, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.request_logs (
    kind text NOT NULL,
    project_id text NOT NULL,
    id text NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    data jsonb NOT NULL,
    CONSTRAINT "PK_request_logs" PRIMARY KEY (kind, project_id, id),
    CONSTRAINT "FK_request_logs_projects_kind_project_id" FOREIGN KEY (kind, project_id) REFERENCES mockingbird.projects (kind, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.rest_endpoints (
    project_id text NOT NULL,
    id text NOT NULL,
    kind text NOT NULL,
    position integer NOT NULL,
    method text,
    path text,
    description text,
    request_body_example text,
    response_body text,
    status_code integer,
    authentication_required boolean,
    require_exact_request_values boolean,
    request_content_type text,
    response_content_type text,
    headers_present boolean NOT NULL,
    CONSTRAINT "PK_rest_endpoints" PRIMARY KEY (project_id, id),
    CONSTRAINT "FK_rest_endpoints_projects_kind_project_id" FOREIGN KEY (kind, project_id) REFERENCES mockingbird.projects (kind, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.soap_operations (
    project_id text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    position integer NOT NULL,
    soap_action text,
    request_xml text,
    response_xml text,
    customized boolean,
    CONSTRAINT "PK_soap_operations" PRIMARY KEY (project_id, name),
    CONSTRAINT "FK_soap_operations_projects_kind_project_id" FOREIGN KEY (kind, project_id) REFERENCES mockingbird.projects (kind, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.collection_request_headers (
    owner uuid NOT NULL,
    collection_id text NOT NULL,
    request_id text NOT NULL,
    position integer NOT NULL,
    header_id integer,
    name_encrypted text NOT NULL,
    value_encrypted text NOT NULL,
    CONSTRAINT "PK_collection_request_headers" PRIMARY KEY (owner, collection_id, request_id, position),
    CONSTRAINT "FK_collection_request_headers_collection_requests_owner_collec~" FOREIGN KEY (owner, collection_id, request_id) REFERENCES mockingbird.collection_requests (owner, collection_id, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.collection_request_operations (
    owner uuid NOT NULL,
    collection_id text NOT NULL,
    request_id text NOT NULL,
    position integer NOT NULL,
    name_encrypted text NOT NULL,
    soap_action_encrypted text NOT NULL,
    request_xml_encrypted text,
    CONSTRAINT "PK_collection_request_operations" PRIMARY KEY (owner, collection_id, request_id, position),
    CONSTRAINT "FK_collection_request_operations_collection_requests_owner_col~" FOREIGN KEY (owner, collection_id, request_id) REFERENCES mockingbird.collection_requests (owner, collection_id, id) ON DELETE CASCADE
);


CREATE TABLE mockingbird.endpoint_response_headers (
    project_id text NOT NULL,
    endpoint_id text NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    CONSTRAINT "PK_endpoint_response_headers" PRIMARY KEY (project_id, endpoint_id, name),
    CONSTRAINT "FK_endpoint_response_headers_rest_endpoints_project_id_endpoin~" FOREIGN KEY (project_id, endpoint_id) REFERENCES mockingbird.rest_endpoints (project_id, id) ON DELETE CASCADE
);


CREATE UNIQUE INDEX "IX_access_users_api_key" ON mockingbird.access_users (api_key);


CREATE UNIQUE INDEX "IX_access_users_email" ON mockingbird.access_users (email);


CREATE UNIQUE INDEX "IX_access_users_encryption_scope" ON mockingbird.access_users (encryption_scope);


CREATE INDEX "IX_access_users_status" ON mockingbird.access_users (status);


CREATE INDEX "IX_projects_owner_kind" ON mockingbird.projects (owner, kind);


CREATE INDEX "IX_rate_windows_minute" ON mockingbird.rate_windows (minute);


CREATE INDEX "IX_request_logs_expires_at" ON mockingbird.request_logs (expires_at);


CREATE INDEX "IX_request_logs_kind_project_id_recorded_at_id" ON mockingbird.request_logs (kind, project_id, recorded_at, id);


CREATE INDEX "IX_rest_endpoints_kind_project_id" ON mockingbird.rest_endpoints (kind, project_id);


CREATE INDEX "IX_rest_endpoints_project_id_method_path" ON mockingbird.rest_endpoints (project_id, method, path);


CREATE INDEX "IX_soap_operations_kind_project_id" ON mockingbird.soap_operations (kind, project_id);


