import ResourcesProperties from './ResourcesProperties.js'
import Studio from 'jsreport-studio'

Studio.addPropertiesComponent(ResourcesProperties.title, ResourcesProperties, (entity) => entity.__entitySet === 'templates')
