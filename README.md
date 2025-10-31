## PhET Launchpad

Launchpad is a web app that allows team members to run PhET simulations (and other tools) on an internal server without 
having to check out code.

This is currently available at https://bayes.colorado.edu/launchpad/

It is also possible to run this locally, to launch simulations on your own machine and working copy.

### Bayes Launchpad

Launchpad is installed under /data/share/phet/launchpad/ and should be modified with the `phet-admin` user (`sudo -i -u phet-admin`).

/etc/httpd/conf.d/bayes.colorado.edu.conf contains the Apache configuration to forward requests to the launchpad service.
It will forward all traffic from /launchpad/* to the launchpad node process (and will strip off the '/launchpad' prefix).

#### Updating Launchpad

To update launchpad to the latest main branch code, run the following commands on bayes (under the phet-admin user):

```sh
cd /data/share/phet/launchpad/launchpad
git pull
npm install
```

Then to update the client-side code (it will be delivered out of the /data/share/phet/launchpad/launchpad/dist/ directory):
```sh
npm run build-client-prod
```

Finally, if there were changes to the server code, restart the launchpad service:
```sh
pm2 restart launchpad
```

#### Viewing Launchpad Logs

```sh
pm2 logs launchpad
```

### Local Launchpad

To run launchpad locally (with other phet repos checked out), do the following:

First get node modules installed:
```sh
cd launchpad
npm install
```

Build the client code (into the dist/ directory, that will be served by the launchpad server):
```sh
npm run build-client-dev
```
(note that the build-client-dev step can be run while the server is running, and will be immediately available upon browser refresh).

Then start the server:
```sh
npm run local-server
```

This will run the server without the auto-update, auto-build, and auto-release-branch-checkout features that are used on bayes.

It will then be viewable on http://localhost:45372/

To customize the port (e.g. to set it for port 80), inspect the package.json for the local-server command and copy it to customize.