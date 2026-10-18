# Backend structure

Open `MockingBird.slnx` to work on the ASP.NET Core API. EF Core handles PostgreSQL persistence. The application uses Minimal API endpoints grouped by responsibility.

```text
MockingBird.Api/
|-- Program.cs                 Application composition and middleware order
|-- Configuration/             Settings loading, dependency injection, authentication, Swagger
|-- Endpoints/                 HTTP routes grouped by feature and request body reading
|-- Services/                  Application operations and business rules
|-- Contracts/                 API request and response types
|-- Data/
|   |-- MockingBirdDbContext.cs EF Core context and shared model conventions
|   |-- Entities/              Persisted entities, one type per file
|   |-- Configurations/        EF table, key, relationship, and conversion mappings
|   |-- Mapping.cs             Entity-to-contract mapping extensions
|   `-- LogJson.cs             Captured-log JSON serialization
|-- Infrastructure/
|   |-- Database/              PostgreSQL connection configuration
|   |-- Http/                  Outbound HTTP requests and SSRF protection
|   |-- Security/              Collection encryption
|   |-- Soap/                  WSDL parsing
|   `-- Templating/            JSON/XML response-template processing
|-- Middleware/                Error handling, security headers, CSRF enforcement
|-- Properties/                Local launch profiles
`-- certificates/              Database TLS certificate
```

`database/` beside the API project contains the initialization schema and versioned SQL migrations.

Configuration uses the standard `appsettings.json` and `appsettings.{Environment}.json` files. In Development, `appsettings.Local.json` supplies local overrides. This file is ignored by Git and excluded from build and publish output. Copy `appsettings.Local.example.json` to `appsettings.Local.json` when configuring a new machine. Keep the existing collection encryption secret so stored collections remain decryptable.

The settings use `ConnectionStrings:Supabase`, `Authentication:Google:ClientId`, `Authentication:Google:ClientSecret`, `Collections:EncryptionSecret`, `Access:AdminEmails` (an array), and `Database:RootCertificate` (optional). Environment variables and command-line arguments take precedence over the local JSON file. For deployments, use .NET-style environment variables such as `ConnectionStrings__Supabase` and `Collections__EncryptionSecret`. Array entries use keys such as `Access__AdminEmails__0`. The application does not load `.env` files.

Put each top-level class or record in a matching file and use a namespace matching its folder. Keep startup wiring in `Configuration/` and the execution order in `Program.cs`. Add HTTP routes to the corresponding endpoint group; put application rules in services and persistence mappings in `Data/Configurations/`. Use contracts at the HTTP boundary and entities for EF Core persistence.

The services use `MockingBirdDbContext` directly. A separate repository layer is unnecessary for the current application. Infrastructure contains protocol handling, cryptography, and external communication. Private helper types used only by a single implementation may stay nested in that class.

Build and run from this folder:

```powershell
dotnet build MockingBird.slnx -c Release
dotnet run --project MockingBird.Api --launch-profile http
```

The HTTP and HTTPS launch profiles target `swagger` and enable browser launch in Visual Studio. Swagger UI is available in Development at `http://localhost:5080/swagger` (or `https://localhost:7176/swagger` with the HTTPS profile). The CLI uses the profile's environment and URLs; open the Swagger URL manually when running with `dotnet run`.
