# Configuration

You can configure Headplane using environment variables.

#### Required Variables

- **`COOKIE_SECRET`**: A secret used to sign cookies (use a relatively long and random string).
- **`HEADSCALE_URL`**: The public URL of your Headscale server (not required if using the configuration file).

#### Optional Variables

- **`HOST`**: The host to bind the server to (default: `0.0.0.0`).
- **`PORT`**: The port to bind the server to (default: `3000`).
- **`CONFIG_FILE`**: The path to the Headscale `config.yaml` (default: `/etc/headscale/config.yaml`).
- **`ACL_FILE`**: The path to the ACL file (default: `/etc/headscale/acl_policy.json`, not needed if you have `acl_policy_path` in your config).
- **`HEADSCALE_CONTAINER`**: The name of the Headscale container (required for Docker integration).

### SSO/OpenID Connect
If you want to use OpenID Connect for SSO, you'll need to provide these variables.
Headplane will utilize the expiry of your tokens to determine the expiry of the session.
If you use the Headscale configuration integration, these are not required.

- **`OIDC_ISSUER`**: The issuer URL of your OIDC provider.
- **`OIDC_CLIENT_ID`**: The client ID of your OIDC provider.
- **`OIDC_CLIENT_SECRET`**: The client secret of your OIDC provider.
- **`API_KEY`**: An API key used to issue new ones for sessions (keep expiry fairly long).
- **`DISABLE_API_KEY_LOGIN`**: If you want to disable API key login, set this to `true`.

Here's what an example with Authelia would look like if you used the same client for both Headscale and Headplane.
Keep in mind that the recommended deployment would be putting Headplane behind /admin on a reverse proxy.
If you use a different domain than the Headscale server, you'll need to make sure that Headscale responds with CORS headers.

```yaml
- client_id: 'headscale'
  client_name: 'Headscale and Headplane'
  public: false
  authorization_policy: 'two_factor'
  redirect_uris:
      - 'https://headscale.example.com/oidc/callback'
      - 'https://headscale.example.com/admin/oidc/callback'
  scopes:
      - 'openid'
      - 'profile'
      - 'email'
  userinfo_signed_response_alg: 'none'
  client_secret: 'my_super_secret_client_secret'
```
