import * as ActionTypes from './constants.js'

export const start = () => ({ type: ActionTypes.PROGRESS_START })
export const stop = () => ({ type: ActionTypes.PROGRESS_END })
