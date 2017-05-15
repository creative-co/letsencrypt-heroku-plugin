## Letsencrypt Heroku Plugin [DEPRECATED]

### This plugin is deprecated

Please use [Heroku Automated Certificate Management](https://devcenter.heroku.com/articles/automated-certificate-management) instead


### Info

Heroku plugin which makes it easy to maintain an SNI SSL endpoint with a certificate
obtained via LetsEncrypt. Integrate it into your CI to get auto-renewal.

### Installation

```bash
$ heroku plugins:install letsencrypt-heroku-plugin
```

### Usage

1. Make sure REDIS_URL is set in your Heroku app:

```bash
$ heroku addons:create heroku-redis
```

2. Within your app, implement ACME challenge:

TODO: move this to a gem, create examples for Rack / Express / Koa

```ruby
# routes.rb - assuming you're on Rails
Rails.application.routes.draw do
  get '/.well-known/acme-challenge/*key' => proc { |env| [200, {}, [Redis.new(url: ENV["REDIS_URL"]).get(env['PATH_INFO']) || ""]] }
end
```

3. Run the plugin on your local machine:

```bash
$ heroku letsencrypt:run
```

### Using from CI

To get auto-renewal, run this plugin on daily basis from your CI
(e.g. via [Semaphore scheduled builds](https://semaphoreci.com/docs/scheduling-builds.html))

1. Authorize your CI to access your Heroku app by setting `HEROKU_API_KEY` environment variable
to your API key from your [Heroku account page](https://dashboard.heroku.com/account).

2. Configure app name by setting `HEROKU_APP` environment variable or using `-a` CLI option

### Configuration options

By default, the plugin will only issue a new certificate if the current certificate expires
in 7 days or less. You can tune this behavior by setting `EXPIRATION_THRESHOLD` to a different number of days.

You can force certificate re-creation using `--force` CLI option.

NOTE: There is a rate limit on the API (~5 certificates per week).
Set `LETSENCRYPT_SERVER` environment variable to `staging` when experimenting to overcome this limitation.
Remember: staging certificates are not generally trusted and should be only used for experiments.

### Troubleshooting

Set `HEROKU_DEBUG` and/or `LETSENCRYPT_DEBUG` env variables to `1` to see Heroku API logs and ACME details.

You might need to reset certbot cache in case you experimented with staging LetsEncrypt server first
and then switched to production LetsEncrypt server. On MacOS, just delete `~/letsencrypt` folder.

### TODO

* linting
* (?) ES6 modules
* le-store-in-memory to avoid caching issues and  rm -rf ~/letsencrypt
* multiple domains per app
* wildcard domains
* checking whether domains list changed / matches current alt names on the certificate
* packaged server implementations (Rails / Rack / Express / Koa / ....)
* validating DNS setup (CNAME checks / interactive guide)
* CI setup

### Authors

* Vladimir Yartsev
* Alex Netrebsky

### Credits

Thanks to https://github.com/gboudreau for inspiration.
