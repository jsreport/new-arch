const oracledb = require('oracledb')
const Store = require('jsreport-sql-store')

module.exports = async (reporter, definition) => {
  if (reporter.options.store.provider !== 'oracle') {
    definition.options.enabled = false
    return
  }

  function transformBindVarsBoolean (bindVars) {
    for (let index = 0; index < bindVars.length; index++) {
      const bindVar = bindVars[index]

      if (bindVar === true) {
        bindVars[index] = 1
      } else if (bindVar === false) {
        bindVars[index] = 0
      }
    }
  }

  function transformResultBoolean (row, es, model) {
    if (model.entitySets[es]) {
      const entityTypeName = model.entitySets[es].entityType.replace(model.namespace + '.', '')
      const entityType = model.entityTypes[entityTypeName]

      for (const propertyName in entityType) {
        const propertyType = entityType[propertyName]

        if (propertyType.type === 'Edm.Boolean') {
          if (row[propertyName] === 1) {
            row[propertyName] = true
          } else if (row[propertyName] === 0) {
            row[propertyName] = false
          }
          continue
        }

        if (propertyType.complexType) {
          for (const complexColumnName in propertyType.complexType) {
            if (row[propertyName + '_' + complexColumnName] != null) {
              if (propertyType.complexType[complexColumnName].type === 'Edm.Boolean') {
                if (row[propertyName + '_' + complexColumnName] === 1) {
                  row[propertyName + '_' + complexColumnName] = true
                } else if (row[propertyName + '_' + complexColumnName] === 0) {
                  row[propertyName + '_' + complexColumnName] = false
                }
              }
            }
          }
        }
      }
    }
  }

  async function executeQuery (q, opts = {}) {
    async function execute (conn) {
      const bindVars = []

      for (let i = 0; i < q.values.length; i++) {
        bindVars.push(q.values[i])
      }

      transformBindVarsBoolean(bindVars)

      const res = await conn.execute(q.text, bindVars, { outFormat: oracledb.OUT_FORMAT_OBJECT })

      if (res.rows && opts.entitySet) {
        for (const row of res.rows) {
          transformResultBoolean(row, opts.entitySet, reporter.documentStore.model)
        }
      }

      return {
        records: res.rows,
        rowsAffected: res.rowsAffected
      }
    }

    let conn

    try {
      if (!opts.transaction) {
        conn = await pool.getConnection()
      } else {
        conn = opts.transaction
      }

      const res = await execute(conn)

      if (!opts.transaction) {
        await conn.commit()
      }

      return res
    } finally {
      if (conn && !opts.transaction) {
        conn.close(() => {})
      }
    }
  }

  const transactionManager = {
    async start () {
      return pool.getConnection()
    },
    async commit (conn) {
      try {
        await conn.commit()
      } finally {
        conn.close(() => {})
      }
    },
    async rollback (conn) {
      try {
        await conn.rollback()
      } finally {
        conn.close(() => {})
      }
    }
  }

  // use clob instead of the limited varchar2(4000) by setting maxLength = max
  reporter.documentStore.on('before-init', () => {
    function processType (typeName, typeDef) {
      for (const propName in typeDef) {
        const propDef = typeDef[propName]
        if (propDef.type === 'Edm.String') {
          if (propDef.document) {
            propDef.maxLength = 'max'
          } else if (typeName === 'SettingType' && propName === 'value') {
            propDef.maxLength = 'max'
          }
        } else {
          if (typeName === 'VersionType' && propName === 'changes') {
            propDef.maxLength = 'max'
          }
        }
      }
    }

    for (const typeName in reporter.documentStore.model.complexTypes) {
      processType(typeName, reporter.documentStore.model.complexTypes[typeName])
    }

    for (const typeName in reporter.documentStore.model.entityTypes) {
      processType(typeName, reporter.documentStore.model.entityTypes[typeName])
    }
  })

  const store = Object.assign(
    Store(definition.options, 'oracle', executeQuery, transactionManager),
    {
      close: () => {
        if (pool) {
          pool.close(() => {})
        }
      }
    }
  )

  reporter.documentStore.registerProvider(store)

  oracledb.fetchAsString = [oracledb.CLOB]
  oracledb.fetchAsBuffer = [oracledb.BLOB]
  const pool = await oracledb.createPool(definition.options)

  // avoid exposing connection string through /api/extensions
  definition.options = {}
}
