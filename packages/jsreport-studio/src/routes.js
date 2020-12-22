import React from 'react'
import { Route, Switch } from 'react-router-dom'
import { rootPath } from './lib/configuration.js'
import App from './containers/App/App.js'

function getPathDef (path) {
  let currentRootPath = rootPath()

  if (path == null) {
    return currentRootPath === '' ? '/' : currentRootPath
  }

  return `${currentRootPath}${path}`
}

export default (aroutes) => {
  const routes = aroutes || []

  return (
    <Switch>
      <Route exact path={getPathDef()} component={App} />
      <Route exact path={getPathDef('/studio')} component={App} />
      <Route exact path={getPathDef('/studio/:entitySet')} component={App} />
      <Route exact path={getPathDef('/studio/:entitySet/:shortid')} component={App} />
      {routes.map((r) => <Route exact path={r.path} component={r.component} key={r.path} />)}
      <Route component={App} />
    </Switch>
  )
}
