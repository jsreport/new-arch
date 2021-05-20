import * as entities from '../entities'
import * as progress from '../progress'
import * as ActionTypes from './constants'
import uid from '../../helpers/uid'
import api from '../../helpers/api'
import * as selectors from './selectors'
import { push } from 'connected-react-router'
import shortid from 'shortid'
import reformatter from '../../helpers/reformatter'
import { openPreviewWindow, getPreviewWindowOptions } from '../../helpers/previewWindow'
import createTemplateRenderFilesHandler from '../../helpers/createTemplateRenderFilesHandler'
import executeTemplateRender from '../../helpers/executeTemplateRender'
import resolveUrl from '../../helpers/resolveUrl'

import {
  addLog as addProfileLog,
  addOperation as addProfileOperation,
  addError as addProfileError
} from '../../helpers/profileDataManager'

import {
  engines,
  recipes,
  runListeners,
  locationResolver,
  editorComponents,
  concurrentUpdateModal,
  modalHandler
} from '../../lib/configuration'

export function closeTab (id) {
  return (dispatch, getState) => {
    const entity = entities.selectors.getById(getState(), id, false)

    if (entity) {
      const dependantEntityTabs = getState().editor.tabs.filter((t) => {
        return (
          t.type === 'entity' &&
          t._id === id &&
          // this check includes tabs like header-footer/pdf-utils
          t.key !== t._id
        )
      })

      // close also dependant tabs (like header-footer, pdf-utils, etc)
      // if the entity is new of if it is dirty
      dependantEntityTabs.forEach((t) => {
        if (entity.__isNew || entity.__isDirty) {
          dispatch({
            type: ActionTypes.CLOSE_TAB,
            key: t.key
          })
        }
      })
    }

    dispatch({
      type: ActionTypes.CLOSE_TAB,
      key: id
    })

    if (entity) {
      dispatch(entities.actions.unload(id))
    }
  }
}

export function openTab (tab) {
  return async function (dispatch, getState) {
    if (tab.shortid && !tab._id) {
      try {
        tab._id = entities.selectors.getByShortid(getState(), tab.shortid)._id
      } catch (e) {
        dispatch(push(resolveUrl('/')))
        return
      }
    }

    if (tab._id) {
      await entities.actions.load(tab._id)(dispatch, getState)
      tab.entitySet = entities.selectors.getById(getState(), tab._id).__entitySet
    }

    tab.type = tab._id ? 'entity' : 'custom'
    tab.key = tab.key || tab._id

    dispatch({
      type: ActionTypes.OPEN_TAB,
      tab: tab
    })

    dispatch(activateTab(tab.key))
  }
}

export function openNewTab ({ entitySet, entity, name }) {
  const shouldClone = entity != null && entity._id != null

  return async function (dispatch, getState) {
    let id = uid()
    let newEntity
    let clonedEntity

    if (shouldClone) {
      await entities.actions.load(entity._id)(dispatch, getState)
      clonedEntity = entities.selectors.getById(getState(), entity._id)

      newEntity = {
        ...clonedEntity,
        _id: id,
        __entitySet: entitySet,
        shortid: shortid.generate(),
        name
      }
    } else {
      if (entity != null) {
        newEntity = Object.assign({}, entity)
      }

      newEntity = Object.assign(newEntity, {
        _id: id,
        __entitySet: entitySet,
        shortid: shortid.generate(),
        name
      })

      if (entitySet === 'templates') {
        if (newEntity.recipe == null) {
          newEntity.recipe = recipes.includes('chrome-pdf') ? 'chrome-pdf' : 'html'
        }

        if (newEntity.engine == null) {
          newEntity.engine = engines.includes('handlebars') ? 'handlebars' : engines[0]
        }
      }
    }

    dispatch(entities.actions.add(newEntity))

    dispatch({
      type: ActionTypes.OPEN_NEW_TAB,
      tab: {
        _id: id,
        key: id,
        entitySet: entitySet,
        type: 'entity'
      }
    })

    return newEntity
  }
}

export function activateTab (id) {
  return (dispatch, getState) => {
    dispatch({
      type: ActionTypes.ACTIVATE_TAB,
      key: id
    })
  }
}

export function updateHistory () {
  return (dispatch, getState) => {
    const { tab, entity } = selectors.getActiveTabWithEntity(getState())
    let path

    if (tab && tab.customUrl) {
      path = tab.customUrl
    } else if (entity && entity.shortid) {
      path = resolveUrl(`/studio/${entity.__entitySet}/${entity.shortid}`)
    } else {
      path = resolveUrl('/')
    }

    if (locationResolver) {
      path = locationResolver(path, entity)
    }

    if (path !== getState().router.location.pathname) {
      dispatch(push(path))
    }
  }
}

export function update (entity) {
  return async function (dispatch, getState) {
    await entities.actions.update(entity)(dispatch, getState)
  }
}

export function groupedUpdate (entity) {
  return async function (dispatch, getState) {
    await entities.actions.groupedUpdate(entity)(dispatch, getState)
  }
}

export function hierarchyMove (source, target, shouldCopy = false, replace = false, retry = true) {
  return async function (dispatch, getState) {
    let response

    let sourceEntity = entities.selectors.getById(getState(), source.id)

    if (sourceEntity.__isNew || sourceEntity.__isDirty) {
      dispatch(entities.actions.flushUpdates())

      sourceEntity = entities.selectors.getById(getState(), source.id)

      dispatch(entities.actions.update(Object.assign({}, sourceEntity, {
        folder: target.shortid != null ? { shortid: target.shortid } : null
      })))
    } else {
      try {
        dispatch(entities.actions.apiStart())

        response = await api.post('/studio/hierarchyMove', {
          data: {
            source: {
              entitySet: source.entitySet,
              id: source.id,
              onlyChildren: source.onlyChildren
            },
            target: {
              shortid: target.shortid,
              updateReferences: target.updateReferences
            },
            copy: shouldCopy === true,
            replace: replace === true
          }
        })

        if (replace === true) {
          if (Array.isArray(target.children)) {
            const sourceEntity = entities.selectors.getById(getState(), source.id, false)

            let childTargetId
            let childTargetChildren = []

            const allFoldersInsideTarget = target.children.reduce((acu, childId) => {
              const childEntity = entities.selectors.getById(getState(), childId, false)

              if (
                ((target.shortid == null && childEntity.folder == null) ||
                (target.shortid != null && childEntity.folder.shortid === target.shortid)) &&
                childEntity.name === sourceEntity.name
              ) {
                childTargetId = childEntity._id
              }

              if (childEntity.__entitySet === 'folders') {
                acu.push(childEntity.shortid)
              }

              return acu
            }, [])

            target.children.forEach((childId) => {
              const childEntity = entities.selectors.getById(getState(), childId, false)

              if (childEntity.folder && allFoldersInsideTarget.indexOf(childEntity.folder.shortid) !== -1) {
                childTargetChildren.push(childEntity._id)
              }
            })

            if (childTargetId) {
              dispatch(entities.actions.removeExisting(childTargetId, childTargetChildren))
            }
          }
        }

        response.items.forEach((item) => {
          dispatch(entities.actions.addExisting(item))
        })

        dispatch(entities.actions.apiDone())
      } catch (e) {
        if (retry && e.code === 'DUPLICATED_ENTITY' && e.existingEntityEntitySet !== 'folders') {
          dispatch(entities.actions.apiDone())

          return {
            duplicatedEntity: true,
            existingEntity: e.existingEntity,
            existingEntityEntitySet: e.existingEntityEntitySet
          }
        }

        dispatch(entities.actions.apiFailed(e))
      }

      if (target.updateReferences) {
        // refresh target
        const targetEntity = entities.selectors.getByShortid(getState(), target.shortid)
        await entities.actions.load(targetEntity._id, true)(dispatch, getState)
      }

      return response.items
    }
  }
}

export function save () {
  return async function (dispatch, getState) {
    let entityId

    try {
      entityId = selectors.getActiveTab(getState())._id

      dispatch({
        type: ActionTypes.SAVE_STARTED
      })

      await entities.actions.save(entityId, { ignoreFailed: true })(dispatch, getState)

      dispatch({
        type: ActionTypes.SAVE_SUCCESS
      })
    } catch (e) {
      if (e.error && e.error.code === 'CONCURRENT_UPDATE_INVALID') {
        dispatch(progress.actions.stop())

        modalHandler.open(concurrentUpdateModal, {
          entityId: entityId,
          modificationDate: e.error.modificationDate
        })
      } else {
        dispatch(entities.actions.apiFailed(e))
      }
    }
  }
}

export function saveAll () {
  return async function (dispatch, getState) {
    try {
      dispatch({
        type: ActionTypes.SAVE_STARTED
      })

      const entitiesToUpdate = getState().editor.tabs.filter((t) => {
        return (
          t.type === 'entity' &&
          // this check excludes tabs like header-footer/pdf-utils
          t.key === t._id
        )
      })

      await Promise.all(entitiesToUpdate.map((t) => {
        const entity = entities.selectors.getById(getState(), t._id)

        // only save for new or entities that have changed
        if (entity.__isNew || entity.__isDirty) {
          return entities.actions.save(t._id, { ignoreFailed: true })(dispatch, getState)
        }
      }))

      dispatch({
        type: ActionTypes.SAVE_SUCCESS
      })
    } catch (e) {
      if (e.error && e.error.code === 'CONCURRENT_UPDATE_INVALID') {
        dispatch(progress.actions.stop())

        modalHandler.open(concurrentUpdateModal, {
          entityId: e.entityId
        })
      } else {
        dispatch(entities.actions.apiFailed(e))
      }
    }
  }
}

export function reformat (shouldThrow = false) {
  return async function (dispatch, getState) {
    // this flushed the updates
    dispatch(entities.actions.flushUpdates())

    const tab = selectors.getActiveTab(getState())

    const editorReformat = editorComponents[tab.editorComponentKey || tab.entitySet].reformat

    if (!editorReformat && !shouldThrow) {
      return false
    }

    const activeEntity = selectors.getActiveEntity(getState())
    const toUpdate = editorReformat(reformatter, activeEntity, tab)

    dispatch(update(Object.assign({ _id: activeEntity._id }, toUpdate)))

    return true
  }
}

export function remove () {
  return async function (dispatch, getState) {
    const tab = selectors.getActiveTab(getState())
    await dispatch(entities.actions.remove(tab._id))
  }
}

export function preview ({ type, data = null, activeTab, completed = false }) {
  const previewId = uid()

  return (dispatch) => {
    dispatch({
      type: ActionTypes.PREVIEW,
      preview: {
        id: previewId,
        type,
        data,
        activeTab,
        completed
      }
    })

    return previewId
  }
}

export function updatePreview (id, params = {}) {
  const toUpdate = {}

  if (Object.hasOwnProperty.call(params, 'data')) {
    toUpdate.data = params.data
  }

  if (Object.hasOwnProperty.call(params, 'activeTab')) {
    toUpdate.activeTab = params.activeTab
  }

  if (Object.hasOwnProperty.call(params, 'completed')) {
    toUpdate.completed = params.completed
  }

  return {
    type: ActionTypes.UPDATE_PREVIEW,
    preview: {
      id,
      ...toUpdate
    }
  }
}

export function clearPreview () {
  return (dispatch) => {
    dispatch(preview({ type: 'empty', completed: true }))
  }
}

export function run (params = {}, opts = {}) {
  return async function (dispatch, getState) {
    const supportedTargets = ['preview', 'window']
    const template = params.template != null ? params.template : Object.assign({}, selectors.getLastActiveTemplate(getState()))
    const templateName = template.name

    const request = {
      template,
      options: params.options != null ? params.options : {}
    }

    const undockMode = getState().editor.undockMode

    let targetType
    let profiling

    if (opts.target != null) {
      targetType = opts.target
    } else if (undockMode) {
      targetType = 'window'
    } else {
      targetType = 'preview'
    }

    if (supportedTargets.indexOf(targetType) === -1) {
      throw new Error(`Run template preview target type "${targetType}" is not supported`)
    }

    if (targetType === 'preview') {
      profiling = opts.profiling != null ? opts.profiling : true
    } else {
      profiling = false
    }

    const entities = Object.assign({}, getState().entities)

    await Promise.all([...runListeners.map((l) => l(request, entities))])

    let previewId
    let previewWindow

    let previewData = {
      template: {
        name: template.name,
        shortid: template.shortid
      },
      reportSrc: null,
      reportFile: null
    }

    if (profiling) {
      previewData.profileOperations = []
      previewData.profileLogs = []
      previewData.profileErrors = { global: null, general: null, operations: [] }
    }

    dispatch({ type: ActionTypes.RUN })

    if (targetType === 'preview') {
      previewId = dispatch(preview({
        type: profiling ? 'report-profile' : 'report',
        data: previewData
      }))
    } else if (targetType === 'window') {
      previewWindow = openPreviewWindow(getPreviewWindowOptions(template != null ? template.shortid : undefined))
    }

    try {
      await executeTemplateRender(request, {
        onStart: () => {
          if (targetType === 'window') {
            previewWindow.focus()
          }
        },
        onFile: createTemplateRenderFilesHandler({
          profiling,
          onLog: (log) => {
            previewData = addProfileLog(previewData, log)

            dispatch(updatePreview(previewId, {
              data: previewData
            }))
          },
          onOperation: (operation) => {
            previewData = addProfileOperation(previewData, operation)

            dispatch(updatePreview(previewId, {
              data: previewData
            }))
          },
          onError: (errorInfo) => {
            if (profiling) {
              previewData = addProfileError(previewData, errorInfo)

              dispatch(updatePreview(previewId, {
                data: previewData
              }))
            }

            const reportSrc = URL.createObjectURL(
              new Blob([
                `Report${templateName != null ? ` "${templateName}"` : ''} render failed.\n\n${errorInfo.message}\n${errorInfo.stack}`
              ], { type: 'text/plain' })
            )

            if (targetType === 'window') {
              previewWindow.location.href = reportSrc
            } else {
              previewData = {
                ...previewData,
                reportSrc
              }

              dispatch(updatePreview(previewId, {
                data: previewData
              }))
            }
          },
          onReport: (reportFileInfo) => {
            const reportSrc = URL.createObjectURL(
              new window.File([reportFileInfo.rawData.buffer], reportFileInfo.filename, {
                type: reportFileInfo.contentType
              })
            )

            previewData = {
              ...previewData,
              reportSrc,
              reportFile: {
                filename: reportFileInfo.filename,
                rawData: reportFileInfo.rawData,
                contentType: reportFileInfo.contentType
              }
            }

            if (targetType === 'window') {
              previewWindow.location.href = reportSrc
            } else {
              dispatch(updatePreview(previewId, {
                data: previewData
              }))
            }
          }
        })
      })
    } catch (error) {
      if (targetType === 'preview' && profiling) {
        previewData = addProfileError(previewData, {
          type: 'globalError',
          message: error.message,
          stack: error.stack
        })

        dispatch(updatePreview(previewId, {
          data: previewData
        }))
      }

      const errorURLBlob = URL.createObjectURL(new Blob([`${error.message}\n\n${error.stack}`], { type: 'text/plain' }))

      if (targetType === 'window') {
        previewWindow.location.href = errorURLBlob
      } else {
        previewData = {
          ...previewData,
          reportSrc: errorURLBlob
        }

        dispatch(updatePreview(previewId, {
          data: previewData
        }))
      }
    } finally {
      if (targetType === 'preview') {
        dispatch(updatePreview(previewId, { completed: true }))
      }
    }
  }
}

export function activateUndockMode () {
  return {
    type: ActionTypes.ACTIVATE_UNDOCK_MODE
  }
}

export function desactivateUndockMode () {
  return {
    type: ActionTypes.DESACTIVATE_UNDOCK_MODE
  }
}
