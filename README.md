# MockingBird

The two applications live in separate folders:

- `backend/`: ASP.NET Core API, EF Core entities, .NET solution, and database schema.
- `frontend/`: React application built with Vite.

Open `backend/MockingBird.slnx` for .NET development. Open `frontend/` for React development.

The [backend structure guide](backend/README.md) describes where endpoints, services, contracts, EF Core entities and mappings, infrastructure, and middleware belong.

```text
mockingbirdreact_dotnet/
├── frontend/             # React source, Vite config, and npm dependencies
│   └── src/
├── backend/
│   ├── MockingBird.Api/  # ASP.NET Core application and configuration
│   └── database/         # SQL schema and migrations
└── README.md
```

Each application has its own build and dependencies. The frontend calls the backend through HTTP; Vite proxies those requests during development. Frontend build output stays in `frontend/dist/`. The API also supports optionally serving a deployed frontend from its `wwwroot/` folder.

## Run locally

From `backend/`:

```powershell
dotnet run --project MockingBird.Api --launch-profile http
```

From `frontend/`, in a second terminal:

```powershell
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards API requests to port 5080.
The API's development Swagger page is http://localhost:5080/swagger. Visual Studio launch profiles open this page automatically; with the CLI, open the URL in your browser.
Backend configuration uses `appsettings.json` and `appsettings.Development.json`. Local credentials stay in the ignored `backend/MockingBird.Api/appsettings.Local.json`, loaded only in Development. Copy `appsettings.Local.example.json` to that filename when setting up a new machine.

## Verify

From `backend/`:

```powershell
dotnet build MockingBird.slnx -c Release
```

From `frontend/`:

```powershell
npm run build
```

The SQL in `backend/database/schema.sql` initializes an empty database only. Do not run it against the existing Supabase database.

## Payload and log storage

Application metadata uses relational tables and typed EF Core entities. REST request examples, response templates, and encrypted collection bodies remain complete scalar payloads. SOAP request/response XML and WSDL remain complete XML strings. These payloads are never expanded into application tables.

Captured HTTP logs use one JSONB `data` document per row, with `kind`, `project_id`, `id`, `recorded_at`, and `expires_at` columns for ownership, pagination, and retention. JSON and XML body text is preserved inside the document. The shared-database upgrade is in `backend/database/migrations/202610090001_log_documents.sql`. This upgrade must be applied to the existing Supabase database before the new log mapping can run against it.

## User ownership

Users have a stable UUID primary key. Mock projects, collections, collection child rows, and user features reference that UUID through foreign keys. Email remains the login identifier. The separate `encryption_scope` column preserves the original encryption context so existing encrypted requests continue to decrypt; it is never used as a relationship key. The upgrade is `backend/database/migrations/202610100001_user_ids.sql`.
