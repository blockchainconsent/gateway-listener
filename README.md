# Gateway-listener
##
## Environment Variables

Create a `.env` file in /src with the following required variables

```
APP_ID_URL=
APP_ID_TENANT_ID=
APP_ID_CLIENT_ID=
APP_ID_SECRET=

KEYPROTECT_URL=
KEYPROTECT_GUID=
KEYPROTECT_SERVICE_API_KEY= - for dev and local testing, populate with your [IBM Cloud API Key](https://cloud.ibm.com/docs/account?topic=account-userapikey#create_user_key)

CLOUDANT_URL=
CLOUDANT_USERNAME=
CLOUDANT_PASSWORD=

EVENT_BROKERS=
EVENT_SASL_PASSWORD=
EVENT_INPUT_TOPIC=
EVENT_FAILURE_TOPIC_1=
EVENT_FAILURE_TOPIC_2=
EVENT_FAILURE_TOPIC_3=
MAX_BYTES_PER_PARTITION_FOR_CONSUMER=

AUTH_PASSWORD=
DEFAULTS_USER_PASSWORD=

DEV_MODE=
```
## Local Database Configuration
You have a few options for configuring a local database that can be used for testing purposes.
###### CouchDB
Below is an example of how to run container with _CouchDB_.

`docker run -d --name gateway-couchdb -p 5984:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password couchdb:latest`

To access UI open in a browser reference `http://localhost:5984/_utils/`

###### Run cloudant-developer container

If you still want to use database from _cloudant-developer_ container.
Run container with next command:

`docker run --rm -d --name gateway-cloudant-db -p 9080:80 ibmcom/cloudant-developer:latest`

To access UI open `http://localhost:9080/dashboard.html` link in browser.

#### Configure the application to use local database

Just update section `config.databaseConfig.connection` in config file `./config/conifg.json` with your database
URL and credentials. For example:

```json lines
{
  // ...
  "databaseConfig": {
    // ...
    "connection": {
      // ...
      "url": "http://localhost:5984",
      "username": "admin",
      "password": "password",
    }
  }
}
```

Or add appropriate environment variables to startup command:

`CLOUDANT_URL=http://localhost:5984 CLOUDANT_USERNAME=admin CLOUDANT_PASSWORD=password npm start`

#### Run application

If you have configured database in config file just execute `npm start` command.

If you decided to use environment variables for database configuration execute next command:

`CLOUDANT_URL=http://localhost:5984 CLOUDANT_USERNAME=admin CLOUDANT_PASSWORD=password npm start`

#### Run Cloudant connection through proxy

If you decided to use proxy server in order to connect to the Kafka please configure `proxyEnabled` `proxyBrokersPorts` `proxyHost` values in config.

## Lint all files

`npm run lint`

### Lint fix

`npm run lint:fix`
