# HTTP requests

Always use `ofetch` for application HTTP requests. Use `ofetch.create()` for a service-specific client with shared configuration, such as a base URL, authentication headers and timeouts. In Nuxt, `$fetch` is the framework-provided ofetch client and follows the same policy.

When a specialized client library is already installed for a service, use that client instead—for example, our Directus client. Do not introduce a parallel HTTP implementation for operations it already supports.

Keep authenticated service clients encapsulated in server utilities. Expose specific operations rather than accepting arbitrary URLs or request options from callers. Validate external response data at the boundary and sanitize errors before returning them.

Configure retries deliberately. Disable automatic retries for non-idempotent operations such as appointment creation, where a repeated request could create a duplicate. Never expose credentials or personal request data in logs or errors.
