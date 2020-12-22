# jsreport-debug
[![NPM Version](http://img.shields.io/npm/v/jsreport-debug.svg?style=flat-square)](https://npmjs.com/package/jsreport-debug)
[![Build Status](https://travis-ci.org/jsreport/jsreport-debug.png?branch=master)](https://travis-ci.org/jsreport/jsreport-debug)

jsreport extension collecting and serving logs

## Installation

> npm install jsreport-debug

## Usage

#### Display logs in jsreport studio

![debug](http://jsreport.net/blog/jsreport-debug.gif)

#### Display logs in the response stream

> `POST:` /api/report<br/>
> `BODY:`<br/>
>```js 
>   { 
>      "template": { },    
>      "options": { "debug": { "logsToResponse": true } }
>   } 
>```

#### Serve logs in response header

> `POST:` /api/report<br/>
> `BODY:`<br/>
>```js 
>   { 
>      "template": { },    
>      "options": { "debug": { "logsToResponseHeader": true } }
>   } 
>```

The logs are then serverd in response header `Debug-Logs`.

#### Get logs for particular request within node.js
```js
jsreport.render({...}).then(function(response) {
  response.logs
})
```

## jsreport-core

```js
var jsreport = require('jsreport-core')()
jsreport.use(require('jsreport-debug')())
```

## License
MIT
