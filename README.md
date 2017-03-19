## Heroku Letsencrypt Plugin

### Installation

```bash
$ heroku plugins:install heroku-letsencrypt
```

### Usage

1. Make sure REDIS_URL is set in your Heroku app. If not, just use a free plan of `heroku-redis` add-on

```bash
$ heroku addons:create heroku-redis
```

2. Within your app, implement ACME challenge

TODO: move this to a gem, create examples for Rack / Express / Koa

```ruby
# routes.rb - assuming you're on Rails
def get_acme_token(path)
  Redis.new(url: ENV["REDIS_URL"]).get(path) || %Q(Not Found: "#{path}")
end

Rails.application.routes.draw do
  get '/.well-known/acme-challenge/*key' => proc { |env| [200, {}, [get_acme_token(env['PATH_INFO'])]] }
end
```

3. Run the plugin on your local machine

```bash
$ heroku letsencrypt:run
```

### TODO

* linting
* (?) ES6 modules
* multiple domains per app
* wildcard domains
* packaged server implementations (Rails / Rack / Express / Koa / ....)
* validating HTTP setup and an interactive guide

### Credits
* https://github.com/gboudreau - for the original idea
* Alex Netrebsky - for the initial implementation
