import React, { Component } from 'react'
import Studio from 'jsreport-studio'
import emitter from './emitter'
import findTagInSet from './findTagInSet'

const { noTagGroupName, tagsGroupName } = require('../shared/reservedTagNames')

class EntityTreeTagOrganizer extends Component {
  constructor () {
    super()

    let organizeByDefault = Studio.extensions['tags'].options.organizeByDefault

    if (organizeByDefault == null) {
      organizeByDefault = false
    }

    this.state = {
      organizeByTags: organizeByDefault
    }

    this.onOrganizationModeChange = this.onOrganizationModeChange.bind(this)
  }

  componentDidMount () {
    emitter.on('organizationModeByTagsChanged', this.onOrganizationModeChange)
  }

  componentWillUnmount () {
    emitter.off('organizationModeByTagsChanged', this.onOrganizationModeChange)
  }

  onOrganizationModeChange (organizeByTag) {
    this.setState({
      organizeByTags: organizeByTag
    })
  }

  addItemsByTag (
    newItems,
    entitySetsNames,
    allTagEntities,
    currentTagEntities,
    entitiesByTagAndType,
    entitiesByTypeWithoutTag,
    getEntityTypeNameAttr
  ) {
    const tagsWithNoEntities = []

    allTagEntities.forEach((tag) => {
      const tagName = getEntityTypeNameAttr(tag.__entitySet, tag)
      const entitiesByType = entitiesByTagAndType[tagName]
      const typesInTag = Object.keys(entitiesByType)

      if (
        typesInTag.length === 0 ||
        typesInTag.every((type) => entitiesByType[type].length > 0) === false
      ) {
        tagsWithNoEntities.push(tag)
        return
      }

      let tagItem

      entitySetsNames.forEach((type) => {
        if (type === 'tags') {
          return
        }

        const entities = entitiesByType[type]
        let typeItem

        if (!tagItem) {
          tagItem = {
            name: tagName,
            isGroup: true,
            data: tag,
            items: []
          }

          newItems.push(tagItem)
        }

        if (!entities || entities.length === 0) {
          tagItem.items.push({
            name: type,
            isEntitySet: true,
            items: []
          })

          return
        }

        typeItem = {
          name: type,
          isEntitySet: true,
          items: []
        }

        entities.forEach((entity) => {
          typeItem.items.push({
            name: getEntityTypeNameAttr(entity.__entitySet, entity),
            data: entity
          })
        })

        tagItem.items.push(typeItem)
      })
    })

    tagsWithNoEntities.forEach((tag) => {
      const tagItem = {
        name: getEntityTypeNameAttr(tag.__entitySet, tag),
        isGroup: true,
        data: tag,
        items: []
      }

      entitySetsNames.forEach((type) => {
        if (type === 'tags') {
          return
        }

        tagItem.items.push({
          name: type,
          isEntitySet: true,
          items: []
        })
      })

      newItems.push(tagItem)
    })

    const noTagsItem = {
      name: noTagGroupName,
      isGroup: true,
      items: []
    }

    entitySetsNames.forEach((type) => {
      if (type === 'tags') {
        return
      }

      const item = {
        name: type,
        isEntitySet: true,
        items: []
      }

      const entities = entitiesByTypeWithoutTag[type]

      if (entities) {
        entities.forEach((entity) => {
          item.items.push({
            name: getEntityTypeNameAttr(entity.__entitySet, entity),
            data: entity
          })
        })
      }

      noTagsItem.items.push(item)
    })

    newItems.push(noTagsItem)

    const tagsItem = {
      name: tagsGroupName,
      isEntitySet: true,
      items: []
    }

    if (currentTagEntities) {
      currentTagEntities.forEach((tag) => {
        tagsItem.items.push({
          name: getEntityTypeNameAttr(tag.__entitySet, tag),
          data: tag
        })
      })
    }

    newItems.push(tagsItem)
  }

  groupEntityByTagAndType (collection, allTagEntities, entity, getEntityTypeNameAttr) {
    if (entity.__entitySet === 'tags') {
      const name = getEntityTypeNameAttr(entity.__entitySet, entity)
      collection[name] = collection[name] || {}
    } else if (entity.tags != null) {
      entity.tags.forEach((tag) => {
        const tagFound = findTagInSet(allTagEntities, tag.shortid)

        if (tagFound) {
          const name = getEntityTypeNameAttr(tagFound.__entitySet, tagFound)
          collection[name] = collection[name] || []
          collection[name][entity.__entitySet] = collection[name][entity.__entitySet] || []
          collection[name][entity.__entitySet].push(entity)
        }
      })
    }
  }

  groupEntitiesByTag (entitySetsNames, entities, getEntityTypeNameAttr) {
    const newItems = []
    let allTagEntities = Studio.getReferences().tags || []
    const entitiesByTagAndType = {}
    const entitiesByTypeWithoutTag = {}

    // initialize all tag groups based on all tag entities
    allTagEntities.forEach((entityTag) => {
      this.groupEntityByTagAndType(entitiesByTagAndType, allTagEntities, entityTag, getEntityTypeNameAttr)
    })

    entitySetsNames.forEach((entitySetName) => {
      if (entitySetName === 'tags') {
        return
      }

      const entitiesInSet = entities[entitySetName]

      if (!entitiesInSet) {
        return
      }

      let entitiesInSetCount = entitiesInSet.length

      for (let j = 0; j < entitiesInSetCount; j++) {
        const entity = entitiesInSet[j]

        if (entity.tags != null) {
          this.groupEntityByTagAndType(entitiesByTagAndType, allTagEntities, entity, getEntityTypeNameAttr)
        } else {
          entitiesByTypeWithoutTag[entity.__entitySet] = entitiesByTypeWithoutTag[entity.__entitySet] || []
          entitiesByTypeWithoutTag[entity.__entitySet].push(entity)
        }
      }
    })

    this.addItemsByTag(
      newItems,
      entitySetsNames,
      allTagEntities,
      entities.tags,
      entitiesByTagAndType,
      entitiesByTypeWithoutTag,
      getEntityTypeNameAttr
    )

    return newItems
  }

  render () {
    const { containerStyles } = this.props

    return (
      <div style={containerStyles}>
        {/*
          extending entity tree's react element to configure
          custom rendering of items in tree
        */}
        {React.cloneElement(this.props.children, {}, ({
          renderDefaultTree,
          renderTree,
          getSetsToRender,
          getEntityTypeNameAttr,
          entitySets,
          entities
        }) => {
          const { organizeByTags } = this.state

          if (!organizeByTags) {
            return renderDefaultTree(entitySets, entities)
          }

          return renderTree(this.groupEntitiesByTag(getSetsToRender(entitySets), entities, getEntityTypeNameAttr))
        })}
      </div>
    )
  }
}

export default EntityTreeTagOrganizer
