## Native Integration

The Native integration allows you to run both Headplane and Headscale on
bare-metal servers or virtual machines. This integration is best suited for
environments where Docker or Kubernetes are not available or not desired.

Currently the Native integration only supports automatic reloading of ACLs. It
cannot handle configuration changes as killing the `headscale` process can lead
to undefined behavior or the service not restarting.

### Deployment

Follow the instructions to install Headscale from the
[Linux Installation Guide](https://headscale.net/running-headscale-linux/). As
of now, Headplane requires Node.js 20 to be installed on the system. Once you
are ready, clone the repository (`git clone https://github.com/tale/headplane`),
install dependencies (`npm install`), build the project (`npm run build`), and
start the server (`npm start`).

> If you'd like, you can turn this into a `systemd` unit to manage the service.
> I plan to provide packages and unit files to make this easier in the future.

When running Headplane, you'll need to set environment variables to configure
the application. The `HEADSCALE_INTEGRATION` variable should be set to `proc`.

> For a breakdown of each configuration variable, please refer to the
[Configuration](/docs/Configuration.md) guide. 
> It explains what each variable does, how to configure them, and what the default values are.
