
# jsreport-azure-storage
[![NPM Version](http://img.shields.io/npm/v/jsreport-azure-storage.svg?style=flat-square)](https://npmjs.com/package/jsreport-azure-storage)
[![Build Status](https://travis-ci.com/jsreport/jsreport-azure-storage.png?branch=master)](https://travis-ci.org/jsreport/jsreport-azure-storage)

> jsreport extension adding support for storing blobs in azure storage

Some of the jsreport extensions requires a blob storage for storing binary objects. This implementation stores these objects like output reports inside cost effective azure blob storage.

See the blob sorages general documentation
https://jsreport.net/learn/blob-storages

See how to persist jsreport output reports
https://jsreport.net/learn/reports

## Installation

> npm install jsreport-azure-storage

## Configuration

Required options are:
- `accountName`:  azure blob storage account name
- `accountKey`:  azure blob storage account key

Optionally you can set
- `container`: azure blob storage container, this defaults to jsreport

You can pass these options into jsreport in following ways:

- Through global `blobStorage` options
```js
{
	"blobStorage": {  
		"provider": "azure-storage"
	},
	"extensions": {
		"azure-storage": {
			"accountName": "...",
			"accountKey": "...",
			"container": "..."
		}
	}
}
```

- Pass options directly when using jsreport-core manually
```js
var jsreport = require('jsreport-core')({ blobStorage: { provider: 'azure-storage' } })
jsreport.use(require('jsreport-azure-storage')({}))
```
