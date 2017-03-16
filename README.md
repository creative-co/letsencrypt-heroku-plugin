To get ssl certificate from Let's encrypt and send it to the heroku app please run command:`

`heroku le:certify -a <heroku application name>`

In addition to show debug logs please set `DEBUG='le*'` environment variable. For instance

`env DEBUG='le*' heroku le:certify -a <heroku application name>` (for Fish terminal)
