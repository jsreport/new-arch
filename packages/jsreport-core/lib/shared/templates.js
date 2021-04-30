
module.exports = (reporter) => {
  return {
    resolveTemplate: (templateParams, req) => resolveTemplate(reporter, templateParams, req)
  }
}

async function resolveTemplate (reporter, templateParams, req) {
  let queryResult

  if (templateParams._id) {
    queryResult = {
      query: { _id: templateParams._id },
      meta: { field: '_id', value: templateParams._id }
    }
  } else if (templateParams.shortid) {
    queryResult = {
      query: { shortid: templateParams.shortid },
      meta: { field: 'shortid', value: templateParams.shortid }
    }
  }

  const meta = {}
  let templates = []

  if (queryResult) {
    meta.field = queryResult.meta.field
    meta.value = queryResult.meta.value
    templates = await reporter.documentStore.collection('templates').find(queryResult.query, req)
  } else if (templateParams.name) {
    const nameIsPath = templateParams.name.indexOf('/') !== -1

    meta.field = 'name'
    meta.value = templateParams.name

    if (!templateParams.name.startsWith('/') && nameIsPath) {
      throw reporter.createError('Invalid template path, path should be absolute and start with "/"', {
        statusCode: 400,
        weak: true
      })
    }

    const pathParts = templateParams.name.split('/').filter((p) => p)

    if (pathParts.length === 0) {
      throw reporter.createError('Invalid template path, path should be absolute and target something', {
        statusCode: 400,
        weak: true
      })
    }

    if (!nameIsPath) {
      // if name is not path do global search by name (with no folder).
      // since template name resolution here does not support relative syntax we should not run
      // resolveEntityFromPath if the name is not path
      templates = await reporter.documentStore.collection('templates').find({
        name: templateParams.name
      }, req)
    } else {
      const result = await reporter.folders.resolveEntityFromPath(templateParams.name, 'templates', req)

      if (result) {
        templates = [result.entity]
      }
    }
  }

  let template

  if (templates.length > 1) {
    throw reporter.createError(`Duplicated templates found for query ${meta.field}: ${meta.value}`, {
      statusCode: 400,
      weak: true
    })
  }

  if (templates.length === 1) {
    template = templates[0]
  }

  return template
}
