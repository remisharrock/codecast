
# Try it

The most recent production version can be used
[here](https://codecast.france-ioi.org/v5/).

The development version can be tried
[here](https://codecast.france-ioi.org/next/).
This version can break compatibility with past production releases, that
is, there is no expectation that recordings made on the development
version will remain readable.

# Quick start

(Build `c-to-json` and copy the executable at the root of this project.)

Current version of `c-to-json` doesn't build, you can retrieve the last compiled version (linux) like so :


    curl -O https://codecast.france-ioi.org/next/c-to-json
    sha1sum c-to-json 
    d517a2e95a13ab66fe106443c12aff9764026944  c-to-json

Copy `config.json.template` to `config.json` and edit it.

If not using HTTPS, set session.cookie.secure to false.

If not using oauth2, remove keys "database", "session" and "auth" and
fill in settings in "configs" and "tokens".

If using oauth2, fill in settings in "database", "session" and "auth",
and remove keys "configs" and "tokens".  Use oauth2_schema.sql, and
add rows in user_configs where value is a json object with keys
"s3AccessKeyId", "s3SecretAccessKey", "s3Region", "s3Bucket", and
"uploadPath".  The row with user_id 0 is used for guest settings.


1. setup codecast-examples project and proxy it
to '/examples' also install a cors plugin in your browser to get rid of cors issues..

2. when login in for the first time in development, check the console log for the user_id, which you need to add the db row for the user, that's mentioned above

3. for uploading your own codecast for your dev setup, use "/dev-upload" url, add in backend/server.js, instructions are in there


Add a CORS configuration for your domain in the AWS S3 bucket's Permissions :

```
<CORSConfiguration>
 <CORSRule>
   <AllowedOrigin>http://www.example1.com</AllowedOrigin>

   <AllowedMethod>PUT</AllowedMethod>
   <AllowedMethod>POST</AllowedMethod>
   <AllowedMethod>DELETE</AllowedMethod>

   <AllowedHeader>*</AllowedHeader>
 </CORSRule>
</CORSConfiguration>
```

To install and run the project, or after an update, run:

    npm install
    npm run build
    npm start

For development "npm run build" is not needed as webpack is configured
to watch the source files:

    NODE_ENV=development npm start

# Build for offline use

    rm -rf build
    BUILD=offline NODE_ENV=production npm run build
    zip -r offline.zip build assets

# Documentation

Document for linker : https://github.com/epixode/epic-linker
