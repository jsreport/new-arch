/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 1);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = Studio;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _DocxProperties = __webpack_require__(2);

var _DocxProperties2 = _interopRequireDefault(_DocxProperties);

var _jsreportStudio = __webpack_require__(0);

var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_jsreportStudio2.default.addPropertiesComponent(_DocxProperties2.default.title, _DocxProperties2.default, function (entity) {
  return entity.__entitySet === 'templates' && entity.recipe === 'docx';
});

_jsreportStudio2.default.entityEditorComponentKeyResolvers.push(function (entity) {
  if (entity.__entitySet === 'templates' && entity.recipe === 'docx') {
    var officeAsset = void 0;

    if (entity.docx != null && entity.docx.templateAssetShortid != null) {
      officeAsset = _jsreportStudio2.default.getEntityByShortid(entity.docx.templateAssetShortid, false);
    }

    return {
      key: 'assets',
      entity: officeAsset,
      props: {
        icon: 'fa-link',
        embeddingCode: '',
        helpersEntity: entity,
        displayName: 'docx asset: ' + (officeAsset != null ? officeAsset.name : '<none>'),
        emptyMessage: 'No docx asset assigned, please add a reference to a docx asset in the properties'
      }
    };
  }
});

_jsreportStudio2.default.addApiSpec({
  template: {
    docx: {
      templateAsset: {
        encoding: '...',
        content: '...'
      },
      templateAssetShortid: '...'
    }
  }
});

var pendingModalsLaunch = [];

var pendingModalsInterval = setInterval(function () {
  if (pendingModalsLaunch.length === 0 || _jsreportStudio2.default.isModalOpen()) {
    return;
  }

  var toLaunch = pendingModalsLaunch.splice(0, 1);

  toLaunch[0]();

  if (pendingModalsLaunch.length === 0) {
    clearInterval(pendingModalsInterval);
  }
}, 200);

_jsreportStudio2.default.previewListeners.push(function (request, entities) {
  if (request.template.recipe !== 'docx') {
    return;
  }

  if (_jsreportStudio2.default.extensions.docx.options.beta.showWarning === false) {
    return;
  }

  if (_jsreportStudio2.default.getSettingValueByKey('beta-docx-informed', false) === true) {
    return;
  }

  _jsreportStudio2.default.setSetting('beta-docx-informed', true);

  var launchBetaModal = function launchBetaModal() {
    _jsreportStudio2.default.openModal(function () {
      return React.createElement(
        'div',
        null,
        'docx recipe is currently in the beta phase and in continuous development. There\'re use cases it doesn\'t support yet but we get there soon if you help us with ',
        React.createElement(
          'a',
          { href: 'https://forum.jsreport.net', target: '_blank' },
          'feedback'
        ),
        '. Please note there can be breaking changes in the next versions of the recipe until we reach stable API.'
      );
    });
  };

  pendingModalsLaunch.push(launchBetaModal);
});

_jsreportStudio2.default.previewListeners.push(function (request, entities) {
  if (request.template.recipe !== 'docx') {
    return;
  }

  if (_jsreportStudio2.default.extensions.docx.options.preview.enabled === false) {
    return;
  }

  if (_jsreportStudio2.default.extensions.docx.options.preview.showWarning === false) {
    return;
  }

  if (_jsreportStudio2.default.getSettingValueByKey('office-preview-informed', false) === true) {
    return;
  }

  _jsreportStudio2.default.setSetting('office-preview-informed', true);

  var launchOfficeModal = function launchOfficeModal() {
    _jsreportStudio2.default.openModal(function () {
      return React.createElement(
        'div',
        null,
        'We need to upload your docx report to our publicly hosted server to be able to use Office Online Service for previewing here in the studio. You can disable it in the configuration, see ',
        React.createElement(
          'a',
          {
            href: 'https://jsreport.net/learn/docx', target: '_blank' },
          'https://jsreport.net/learn/docx'
        ),
        ' for details.'
      );
    });
  };

  pendingModalsLaunch.push(launchOfficeModal);
});

_jsreportStudio2.default.previewListeners.push(function () {
  if (pendingModalsLaunch.length === 0) {
    clearInterval(pendingModalsInterval);
  }
});

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(3);

var _react2 = _interopRequireDefault(_react);

var _jsreportStudio = __webpack_require__(0);

var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EntityRefSelect = _jsreportStudio2.default.EntityRefSelect;

var Properties = function (_Component) {
  _inherits(Properties, _Component);

  function Properties() {
    _classCallCheck(this, Properties);

    return _possibleConstructorReturn(this, (Properties.__proto__ || Object.getPrototypeOf(Properties)).apply(this, arguments));
  }

  _createClass(Properties, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.removeInvalidReferences();
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate() {
      this.removeInvalidReferences();
    }
  }, {
    key: 'removeInvalidReferences',
    value: function removeInvalidReferences() {
      var _props = this.props,
          entity = _props.entity,
          entities = _props.entities,
          onChange = _props.onChange;


      if (!entity.docx) {
        return;
      }

      var updatedAssetItems = Object.keys(entities).filter(function (k) {
        return entities[k].__entitySet === 'assets' && entities[k].shortid === entity.docx.templateAssetShortid;
      });

      if (updatedAssetItems.length === 0) {
        onChange({ _id: entity._id, docx: null });
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props,
          entity = _props2.entity,
          _onChange = _props2.onChange;


      return _react2.default.createElement(
        'div',
        { className: 'properties-section' },
        _react2.default.createElement(
          'div',
          { className: 'form-group' },
          _react2.default.createElement(EntityRefSelect, {
            headingLabel: 'Select docx template',
            value: entity.docx ? entity.docx.templateAssetShortid : '',
            onChange: function onChange(selected) {
              return _onChange({ _id: entity._id, docx: selected.length > 0 ? { templateAssetShortid: selected[0].shortid } : null });
            },
            filter: function filter(references) {
              return { data: references.assets };
            }
          })
        )
      );
    }
  }], [{
    key: 'selectAssets',
    value: function selectAssets(entities) {
      return Object.keys(entities).filter(function (k) {
        return entities[k].__entitySet === 'assets';
      }).map(function (k) {
        return entities[k];
      });
    }
  }, {
    key: 'title',
    value: function title(entity, entities) {
      if (!entity.docx || !entity.docx.templateAssetShortid) {
        return 'docx';
      }

      var foundItems = Properties.selectAssets(entities).filter(function (e) {
        return entity.docx.templateAssetShortid === e.shortid;
      });

      if (!foundItems.length) {
        return 'docx';
      }

      return 'docx asset: ' + foundItems[0].name;
    }
  }]);

  return Properties;
}(_react.Component);

exports.default = Properties;

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = Studio.libraries['react'];

/***/ })
/******/ ]);