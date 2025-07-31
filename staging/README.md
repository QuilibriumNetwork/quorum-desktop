The staging site is hosted on QStorage.

The URL that can be visited to see this is https://qstorage.quilibrium.com/quorum-staging.

## Prerequisites:
  - Install the AWS CLI
  - Qstorage credentials
  - A working repository with an Quorum app that can be built (no linter errors, app runs, etc)

## Working Branch
Any branch can be deployed with this, but keep in mind it will overwrite any existing version that is currently running.



## QStorage Credentials
Copy the `staging/qstorage-config.example` to `staging/qstorage-config` and edit the following to whatever your bucket credentials are in csv format (separated by a comma).

The deployment script will import them to the `quorum-staging` profile.

```bash
0000000000000,ASIAIOSFODNN7EXAMPLE,wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Deployment:
The deployment process will build the static files the version of Quorum you have locally, for the branch you have checked out or are developing.

You can deploy versions that are under development, just mind that the build process must complete to finalize the build for it to be deployed.

You can run the deployment script by running the following in the project's root directory.
```bash
yarn deploy:staging
```

### Example: Deploying the `develop` branch
```bash
git checkout develop
yarn deploy:staging
```