class HerokuApi {
  constructor(heroku, app) {
    this.app = app;
    this.heroku = heroku;
  }

  getCustomDomainsList() {
    const takeCustomDomains = arr => arr.filter(domain => domain.kind == 'custom');
    return this.heroku.get('/apps/' + this.app + '/domains').then(takeCustomDomains);
  }

  getConfigVars() {
    return this.heroku.get('/apps/' + this.app + '/config-vars')
  }

  getAccount() {
    return this.heroku.get('/account');
  }

  // SNI SSL endpoints CRUD

  getSslEndpoints() {
    return this.heroku.get(`/apps/${this.app}/sni-endpoints`);
  }


  createSslEndpoint(certificate) {
    return this.heroku.post(`/apps/${this.app}/sni-endpoints`, {
      body: {
        certificate_chain: certificate.cert,
        private_key: certificate.privkey
      }
    });
  }

  updateSslEndpoint(endpoint, certificate) {
    return this.heroku.patch(`/apps/${this.app}/sni-endpoints/${endpoint.id}`, {
      body: {
        certificate_chain: certificate.cert,
        private_key: certificate.privkey
      }
    });
  }
};

module.exports = HerokuApi;
