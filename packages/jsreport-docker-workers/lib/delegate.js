const uuid = require('uuid')
const urlModule = require('url')
const http = require('http')
const extend = require('node.extend')
const omit = require('lodash.omit')
const serializator = require('serializator')

function extendRenderRequest (originalReq, copyReq) {
  extend(true, originalReq, omit(copyReq, ['data']))
  originalReq.data = copyReq.data
}

module.exports = (reporter, { delegateTimeout, onRequestFilter, onResponseFilter, onContainerError }) => {
  return {
    async delegateScript (url, remote, inputs, options, req, fromRemote) {
      const type = 'scriptManager'

      if (remote === true) {
        reporter.logger.debug(`Delegating script to external worker at ${url}`)
      } else {
        reporter.logger.debug(`Delegating script to container in local worker at ${url}`)
      }

      const requestInput = {
        type,
        data: {
          inputs,
          options,
          req: toRawRenderRequest(reporter, req)
        }
      }

      if (!remote) {
        requestInput.uuid = uuid()
      }

      const result = await sendRequestAndHandleActions(type, reporter, url, requestInput, req, undefined, remote, fromRemote)

      return result
    },
    async delegateRecipe (url, remote, recipe, req, res, fromRemote) {
      const type = 'recipe'

      if (remote === true) {
        reporter.logger.debug(`Delegating recipe ${recipe} to external worker at ${url}`)
      } else {
        reporter.logger.debug(`Delegating recipe ${recipe} to container in local worker at ${url}`)
        req.context.uuid = uuid()
      }

      const requestInput = {
        type,
        data: {
          recipe,
          req: toRawRenderRequest(reporter, req),
          res
        }
      }

      if (!remote) {
        requestInput.uuid = req.context.uuid
      }

      const result = await sendRequestAndHandleActions(type, reporter, url, requestInput, req, res, remote, fromRemote)

      return result
    }
  }

  function toRawRenderRequest (reporter, req) {
    if (req && req.constructor && req.constructor.name === 'IncomingMessage') {
      // we create a new request to avoid circular serialization problem when trying to serialize
      // an http incoming message for the worker payload
      return reporter.Request(req)
    }

    return req
  }

  async function sendPost (type, url, originalReq, reqData, opts = {}, isRemote) {
    try {
      const dataToSend = await onRequestFilter({
        type,
        originalReq,
        reqData,
        meta: {
          remote: isRemote,
          url
        }
      })

      const response = await new Promise((resolve, reject) => {
        const urlInfo = urlModule.parse(url)
        const serializedRequestBody = serializator.serialize({
          payload: dataToSend
        })

        const requestOpts = {
          host: urlInfo.hostname,
          port: urlInfo.port,
          path: urlInfo.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(serializedRequestBody)
          },
          timeout: delegateTimeout
        }

        if (opts.auth) {
          requestOpts.auth = `${opts.auth.username}:${opts.auth.password}`
        }

        const postReq = http.request(requestOpts, (res) => {
          let body = Buffer.from([])

          const response = {
            status: res.statusCode
          }

          res.on('error', reject)

          res.on('data', (chunk) => {
            body = Buffer.concat([body, chunk])
          })

          res.on('end', () => {
            const d = Buffer.concat([body]).toString()
            const obj = serializator.parse(d)

            response.data = obj

            if (response.status >= 200 && response.status < 300) {
              resolve({
                data: obj
              })
            } else {
              const reqErr = new Error(`Request failed with status code ${response.status}`)
              reqErr.response = response
              reject(reqErr)
            }
          })
        })

        postReq.on('error', reject)

        postReq.write(serializedRequestBody)
        postReq.end()
      })

      if (!response.data.payload) {
        throw new Error('response from worker must contain ".payload" property in body')
      }

      response.data = await onResponseFilter({
        type,
        originalReq,
        reqData: dataToSend,
        resData: response.data.payload,
        meta: {
          remote: isRemote,
          url
        }
      })

      return response
    } catch (e) {
      if (e.response && e.response.status === 400 && e.response.data && e.response.data.message) {
        const error = reporter.createError(e.response.data.message, {
          weak: true
        })

        error.stack = e.response.data.stack
        throw error
      }

      throw e
    }
  }

  async function sendRequestAndHandleActions (type, reporter, url, requestInput, req, res, remote, fromRemote) {
    let currentRequestInput
    let resp

    currentRequestInput = requestInput

    const reqOptions = {}

    try {
      if (remote === true && reporter.authentication) {
        const authOptions = reporter.options.extensions.authentication

        reqOptions.auth = {
          username: authOptions.admin.username,
          password: authOptions.admin.password
        }
      }

      resp = await sendPost(type, url, req, requestInput, reqOptions, remote)

      while (resp.data.action != null) {
        if (resp.data.action === 'render') {
          const respBody = resp.data

          reporter.logger.debug(`Processing render callback (${type === 'scriptManager' ? 'script' : type}) from worker`)

          if (respBody.data.parentReq) {
            extendRenderRequest(req, respBody.data.parentReq)
          }

          let errorInRender
          let renderRes

          try {
            renderRes = await reporter.render(respBody.data.req, req)
          } catch (e) {
            errorInRender = {
              message: e.message,
              stack: e.stack
            }
          }

          const childRenderRequestInput = {
            error: errorInRender,
            req: toRawRenderRequest(reporter, req)
          }

          if (childRenderRequestInput.error == null) {
            childRenderRequestInput.content = renderRes.content
            childRenderRequestInput.meta = renderRes.meta
          }

          currentRequestInput = childRenderRequestInput

          resp = await sendPost(type, url, req, {
            uuid: type === 'scriptManager' ? requestInput.uuid : req.context.uuid,
            data: childRenderRequestInput
          })
        } else if (
          resp.data.action === 'documentStore.collection.find' ||
          resp.data.action === 'documentStore.collection.findOne'
        ) {
          const respBody = resp.data
          let method

          if (respBody.action === 'documentStore.collection.find') {
            method = 'find'
          } else if (respBody.action === 'documentStore.collection.findOne') {
            method = 'findOne'
          } else {
            throw new Error(`documentStore callback action "${respBody.action}" not supported`)
          }

          reporter.logger.debug(`Processing ${respBody.action} callback (${type === 'scriptManager' ? 'script' : type}) from worker`)

          if (respBody.data.originalReq) {
            extendRenderRequest(req, respBody.data.originalReq)
          }

          let errorInQuery
          let queryRes

          try {
            const collection = reporter.documentStore.collection(respBody.data.collection)
            queryRes = await collection[method](respBody.data.query, req)
          } catch (e) {
            errorInQuery = {
              message: e.message,
              stack: e.stack
            }
          }

          const childRenderRequestInput = {
            error: errorInQuery,
            queryResult: queryRes,
            req: toRawRenderRequest(reporter, req)
          }

          currentRequestInput = childRenderRequestInput

          resp = await sendPost(type, url, req, {
            uuid: requestInput.uuid,
            data: childRenderRequestInput
          })
        } else if (
          resp.data.action === 'folders.resolveEntityPath' ||
          resp.data.action === 'folders.resolveFolderFromPath'
        ) {
          const respBody = resp.data

          let method

          if (respBody.action === 'folders.resolveEntityPath') {
            method = 'resolveEntityPath'
          } else if (respBody.action === 'folders.resolveFolderFromPath') {
            method = 'resolveFolderFromPath'
          } else {
            throw new Error(`folders callback action "${respBody.action}" not supported`)
          }

          reporter.logger.debug(`Processing ${respBody.action} callback (${type === 'scriptManager' ? 'script' : type}) from worker`)

          if (respBody.data.originalReq) {
            extendRenderRequest(req, respBody.data.originalReq)
          }

          let errorInFolderAction
          let folderActionRes

          try {
            const args = []

            if (method === 'resolveEntityPath') {
              args.push(respBody.data.entity)
              args.push(respBody.data.entitySet)
              args.push(req)
            } else {
              args.push(respBody.data.entityPath)
              args.push(req)
            }

            folderActionRes = await reporter.folders[method](...args)
          } catch (e) {
            errorInFolderAction = {
              message: e.message,
              stack: e.stack
            }
          }

          const childRenderRequestInput = {
            error: errorInFolderAction,
            value: folderActionRes,
            req: toRawRenderRequest(reporter, req)
          }

          currentRequestInput = childRenderRequestInput

          resp = await sendPost(type, url, req, {
            uuid: requestInput.uuid,
            data: childRenderRequestInput
          })
        }
      }

      extendRenderRequest(req, resp.data.req)

      if (type === 'recipe' && res) {
        extend(true, res, resp.data.res)
      }

      if (type === 'recipe') {
        if (fromRemote === true) {
          return { req, res }
        }

        return undefined
      } else {
        if (fromRemote !== true) {
          return resp.data.result
        }

        return resp.data
      }
    } catch (e) {
      if (onContainerError) {
        await onContainerError({
          type,
          error: e,
          data: {
            req: req,
            body: currentRequestInput
          }
        })
      }

      throw e
    }
  }
}
