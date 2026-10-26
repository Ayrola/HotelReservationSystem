import { element } from '../utils/dom.js';
export function adminTable(headers,rows) {
  return element('div',{className:'table-responsive'},[
    element('table',{className:'table align-middle'},[
      element('thead',{},[element('tr',{},headers.map(text=>element('th',{scope:'col',text})))]),
      element('tbody',{},rows.map(cells=>element('tr',{},cells.map(cell=>element('td',{},[typeof cell==='string'?document.createTextNode(cell):cell]))))),
    ]),
  ]);
}
