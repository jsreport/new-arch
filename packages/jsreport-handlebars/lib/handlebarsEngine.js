/*!
 * Copyright(c) 2016 Jan Blaha
 */
const pattern = /%}%/g

module.exports = (opts = {}) => {
  return {
    compile: (html, { require }) => {
      const handlebars = require(opts.handlebarsModulePath)
      const results = matchRecursiveRegExp(html, '{', '}', 'g')
      let changed = 0

      results.forEach((info) => {
        if (!info.match.startsWith('#')) {
          return
        }

        const currentOffset = info.offset + (changed * 2)

        html = `${html.slice(0, currentOffset)}${info.match}%}%${html.slice(currentOffset + info.match.length + 1)}`

        changed++
      })

      // this compiles a template representation that does not depend on the current
      // handlebars, we care about this because template can be cached and we need to
      // ensure that the template does not get bound to some previous handlebars
      // instance of different render
      const templateSpecStr = handlebars.precompile(html)

      const templateSpec = new Function(`return ${templateSpecStr}`)() // eslint-disable-line

      return templateSpec
    },
    execute: (templateSpec, helpers, data, { require }) => {
      const handlebars = require(opts.handlebarsModulePath)
      const template = handlebars.template(templateSpec)

      try {
        for (const h in helpers) {
          if (helpers.hasOwnProperty(h)) {
            handlebars.registerHelper(h, helpers[h])
          }
        }

        let result = template(data)

        result = result.replace(pattern, '}')

        return result
      } finally {
        // unregister the helpers to hide them from other executions
        for (const ah in helpers) {
          if (helpers.hasOwnProperty(ah)) {
            handlebars.unregisterHelper(ah, helpers[ah])
          }
        }
      }
    }
  }
}

// taken from: http://blog.stevenlevithan.com/archives/javascript-match-recursive-regexp
function matchRecursiveRegExp (str, left, right, flags) {
  let f = flags || ''
  let g = f.indexOf('g') > -1
  let x = new RegExp(left + '|' + right, 'g' + f.replace(/g/g, ''))
  let l = new RegExp(left, f.replace(/g/g, ''))
  let a = []
  let t
  let s
  let m

  do {
    t = 0

    // eslint-disable-next-line no-cond-assign
    while (m = x.exec(str)) {
      if (l.test(m[0])) {
        if (!t++) s = x.lastIndex
      } else if (t) {
        if (!--t) {
          const match = str.slice(s, m.index)
          a.push({
            offset: s,
            match
          })

          if (!g) return a
        }
      }
    }
  } while (t && (x.lastIndex = s))

  return a
}
