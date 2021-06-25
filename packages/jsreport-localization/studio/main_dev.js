import LocalizationProperties from './LocalizationProperties.js'
import Studio from 'jsreport-studio'

Studio.addApiSpec({
  options: {
    language: 'en'
  }
})

Studio.addPropertiesComponent(LocalizationProperties.title, LocalizationProperties, (entity) => entity.__entitySet === 'templates')
