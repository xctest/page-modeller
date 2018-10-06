import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import dom from './dom';
import profiles from '../profiles/profiles';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

export default class ModelBuilder {
  deDupeName(name) {
    let returnName = name;

    if (name in this.model.usedNames) {
      this.model.usedNames[name] += 1;
      returnName = `${name}${this.model.usedNames[name]}`;
    } else {
      this.model.usedNames[name] = 1;
    }
    return returnName;
  }

  maxLength(name) {
    return name.substring(0, 20);
  }

  cleanName(name) {
    const cc = camelCase(name) || name; // accommodate for weird bug which results in empty string for single character!
    return this.deDupeName(upperFirst(this.maxLength(cc)));
  }

  generateName(element) {
    const id = dom.getId(element);
    const name = dom.getName(element);
    const textContent = dom.getTextContent(element);
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'PROGRESS', 'METER'].includes(tagName)) {
      const label = dom.getLabel(element);
      const labelName = label ? label.textContent.trim() : '';

      if (labelName) {
        return this.cleanName(labelName);
      }

      if (tagName === 'BUTTON' || ['submit', 'reset'].includes(element.type)) {
        const val = element.value.trim();
        if (val) {
          return this.cleanName(val);
        }
      }
    }

    if (name) {
      return this.cleanName(name);
    }
    if (id) {
      return this.cleanName(id);
    }

    if (tagName === 'A' && element.href && element.href.startsWith('mailto:')) {
      return this.cleanName(`${element.href.replace('mailto:', '').split('@')[0]}EmailLink`);
    }

    if (textContent) {
      let n = this.cleanName(textContent);
      if (n.match(/^\d/)) {
        n = `${tagName}${n}`;
      }
      return n;
    }

    return this.cleanName(`${tagName}${tagIndex}`);
  }

  static createEmptyModel() {
    return {
      usedNames: {},
      entities: [],
    };
  }

  createModel({ element, activeProfile, existingModel = null }) {
    console.log('createModel');

    this.model = existingModel || ModelBuilder.createEmptyModel();
    this.activeProfile = activeProfile;

    if (existingModel) {
      this.model.entities.push(this.createEntity(element));
      return this.model;
    }

    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (dom.isVisible(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT; // node and children
        },
      },
      true
    );
    while (walker.nextNode()) {
      const childElement = walker.currentNode;
      if (INTERACTIVE_ELEMENTS.includes(childElement.tagName)) {
        this.model.entities.push(this.createEntity(childElement));
      }
    }
    return this.model.entities.length === 0 ? null : this.model;
  }

  createEntity(element) {
    return {
      name: this.generateName(element),
      locators: this.getLocators(element),
      tagName: dom.getTagName(element),
      type: dom.getTagType(element),
    };
  }

  getLocators(element) {
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    const possibleLocators = [
      {
        name: 'id',
        locator: dom.getId(element),
      },
      {
        name: 'linkText',
        locator: dom.getLinkText(element),
      },
      {
        name: 'partialLinkText',
        locator: dom.getLinkText(element),
      },
      {
        name: 'name',
        locator: dom.getName(element),
      },
      {
        name: 'css',
        locator: dom.getCssSelector(element),
      },
      {
        name: 'className',
        locator: dom.getClassName(element),
      },
      {
        name: 'tagName',
        locator: tagName,
      },
      {
        name: 'xpath',
        locator: dom.getXPath(element),
      },
      {
        name: 'tagIndex',
        locator: `${tagName}${tagIndex}`,
        selected: true,
        always: true,
        hidden: true,
      },
    ];
    const profile = profiles.find(p => p.name === this.activeProfile);

    const locators = [];
    possibleLocators.forEach(l => {
      if (profile.locators.includes(l.name) || l.always) {
        locators.push(l);
      }
    });

    for (let selectedLocator = locators[locators.length - 1], currentLocator, i = 0; i < locators.length; i += 1) {
      currentLocator = locators[i];
      if (currentLocator.locator) {
        delete selectedLocator.selected;
        currentLocator.selected = true;
        break;
      }
    }

    return locators;
  }
}
