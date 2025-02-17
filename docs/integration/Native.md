## Native Integration

The Native integration allows you to run both Headplane and Headscale on
bare-metal servers or virtual machines. This integration is best suited for
environments where Docker or Kubernetes are not available or not desired.

Currently the Native integration only supports automatic reloading of ACLs. It
cannot handle configuration changes as killing the `headscale` process can lead
to undefined behavior or the service not restarting.

### Deployment

1. Follow the instructions to install Headscale from the
[Linux Installation Guide](https://headscale.net/stable/setup/install/official/).

2. Install [Node.js](https://nodejs.org/en/download/package-manager)
version 20 or higher (your package manager most likely already has this).

3. Install [PNPM](https://pnpm.io/installation). This is required
as Headplane has issues running correctly when installed and built via NPM or Yarn.

4. Clone the Headplane repository, install dependencies, and build the project:
```sh
git clone https://github.com/tale/headplane # (or clone via SSH)
cd headplane
pnpm install
pnpm build
```

### Running Headplane
Start Headplane with `node build/headplane/server.js`.

Headplane does need various environment variables to run correctly. The required
variables can be found in the [Configuration](/docs/Configuration.md) guide.
If you choose to do this with a `.env` file, you can use the `LOAD_ENV_FILE`
variable to tell Headplane to load the file.

Finally, make sure to set `HEADSCALE_INTEGRATION=proc` to take advantage
of controlling Headscale natively on Linux.

```sh
LOAD_ENV_FILE=true node ./build/headplane/server.js
```

> If you'd like, you can turn this into a `systemd` unit to manage the service.
> I plan to provide packages and unit files to make this easier in the future.

### Cannot find ./build directory?
Headplane expects the `build` directory to be present when running the server.
The structure of this folder is very important and should not be tampered with.
If you would like to keep the build directory in a different location, you can
set the `BUILD_PATH` environment variable to the path of the build directory
at runtime.

```sh
LOAD_ENV_FILE=true BUILD_PATH=/path/to/build node ./build/headplane/server.js
```

### Changing Headplane's Path from `/admin`
Additionally, because you are building Headplane from source, you're able to
change the default path that Headplane is served from. This can be done by
specifying the `__INTERNAL_PREFIX` environment variable, when building.

```sh
__INTERNAL_PREFIX=/my-admin-path pnpm build
```

> Keep in mind that this is very much an experimental feature. Things can easily
> break and until it's more stable, it's not recommended to use in production.
