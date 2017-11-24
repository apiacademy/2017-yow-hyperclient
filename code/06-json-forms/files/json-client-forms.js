/*******************************************************
 * json-client HTML/SPA client engine
 * profile=forms
 * Mike Amundsen (@mamund)
 *******************************************************/

/*  
  NOTE:
  - has fatal dependency on dom-help.js
  - uses no external libs/frameworks
  - built/tested for chrome browser (YMMV on other browsers)

  ISSUES:
  - memorized the serialized msg for "todo" object array & fields
  - will ignore non-breaking changes from server (new actions, objects, fields)
  - will crash on breaking changes from server (changed actions, objects, fields)
*/

function json() {

  var d = domHelp();  
  var g = {};
  
  g.url = '';
  g.msg = null;
  g.title = "JSON Client";
  g.atype = "application/json;profile=forms";
  g.ctype = "application/json";
  
  // the only fields to process
  g.fields = ["id","title","email","completed", "tags"];
  
  // init library and start
  function init(url, title) {
    if(!url || url==='') {
      alert('*** ERROR:\n\nMUST pass starting URL to the library');
    }
    else {
      g.title = title||"JSON Client";
      g.url = url;
      req(g.url,"get");
    }
  }

  // primary loop
  function parseMsg() {
    dump();
    title();
    items();
    actions();
    clearForm();
  }

  // handle response dump
  function dump() {
    var elm = d.find("dump");
    elm.innerText = JSON.stringify(g.msg, null, 2);
  }
  
  // handle title
  function title() {
    var elm;
    
    elm = d.find("title");
    elm.innerText = g.title;
    
    elm = d.tags("title");
    elm[0].innerText = g.title;
  }
  
  // handle item collection
  function items() {
    var elm, coll, link;
    var ul, li, dl, dt, dd, p;

    elm = d.find("items");
    d.clear(elm);
    
    if(g.msg.todo) {
      coll = g.msg.todo;
      ul = d.node("ul");

      for(var item of coll) {
        li = d.node("li");
        dl = d.node("dl");
        dt = d.node("dt");
        
        // emit item-level actions
        dt = itemActions(dt, item, (coll.length===1));

        // emit the data elements
        dd = d.node("dd");
        for(var f in item) {
          if(f!=="href") {
            p = d.data({className:"item "+f, text:f, value:item[f]+"&nbsp;"});
            d.push(p,dd);
          }
        }
        
        d.push(dt,dl);        
        d.push(dd,dl);
        d.push(ul,elm);
        d.push(dl,li);
        d.push(li,ul);
      }
    }
  }
  
  // handle item-level actions
  function itemActions(dt, item, single) {
    var a, link, href;
    
    // item link
    a = d.anchor({
      href:item.href,  
      rel:"item",
      className:"item action",
      text:"Item"
    });
    a.onclick = httpGet;
    d.push(a,dt);
        
    return dt;  
  }
  
  // handle page-level actions
  function actions() {
    var elm, coll, idx, link;
    var ul, li, a;
    
    elm = d.find("actions");
    d.clear(elm);

    ul = d.node("ul");

    // pull actions from message
    for(var idx in g.msg.actions) {
      link = g.msg.actions[idx];
      li = d.node("li");
      a = d.anchor({
        href:link.href,
        rel:link.rel.join(" ")||"action",
        className:"action",
        text:link.prompt
      });
      if(link.method) {
        a.onclick = jsonForm;
        a.setAttribute("args",JSON.stringify(link.args));
        a.setAttribute("method",link.method);
      }
      else {
        a.onclick = httpGet;
      }
      d.push(a,li);
      d.push(li, ul);
    }    
    d.push(ul, elm);
  }
  
  // ********************************
  // JSON Helpers
  // ********************************
  
  // function clear out any form
  function clearForm() {
    var elm;
    
    elm = d.find("form");
    d.clear(elm);
  }
  
  // generate a form for user input
  function jsonForm(e) {
    var elm, coll, link, val;
    var form, lg, fs, p, inp;
     
    elm = d.find("form");
    d.clear(elm);
    link = e.target;
    
    form = d.node("form");
    form.action = link.href;
    form.className = link.rel;
    switch(link.getAttribute("method")) {
      case "POST":
        form.onsubmit = httpPost;
        break;
      case "PUT":
        form.onsubmit = httpPut;
        break;
      case "DELETE":
        form.onsubmit = httpDelete;
        break;
      case "GET":
      default:
        form.onsubmit = httpQuery;
        break;
    }    
    fs = d.node("fieldset");
    lg = d.node("legend");
    lg.innerHTML = link.title||"Form";
    d.push(lg, fs);

    coll = JSON.parse(link.getAttribute("args"));
    for(var prop in coll) {
      val = coll[prop].value;
      if(g.msg.todo[0][prop]) {
        val = val.replace("{"+prop+"}",g.msg.todo[0][prop]);
      } 
      p = d.input({
        prompt:coll[prop].prompt,
        name:prop,
        value:val, 
        required:coll[prop].required,
        readOnly:coll[prop].readOnly,
        pattern:coll[prop].pattern
      });
      d.push(p,fs);
    }
    //nodes = d.tags("input", form);
    
    p = d.node("p");
    inp = d.node("input");
    inp.type = "submit";
    d.push(inp,p);

    inp = d.node("input");
    inp.type = "button";
    inp.value = "Cancel";
    inp.onclick = function(){elm = d.find("form");d.clear(elm);}
    d.push(inp,p);

    d.push(p,fs);            
    d.push(fs,form);
    d.push(form, elm);
    
    return false;
  }
  
  // ********************************
  // ajax helpers
  // ********************************
  
  // mid-level HTTP handlers
  function httpGet(e) {
    req(e.target.href, "get", null);
    return false;
  }

  function httpQuery(e) {
    var form, coll, query, i, x, q;

    q=0;
    form = e.target;
    query = form.action+"/?";
    for(i=0, x=nodes.length;i<x;i++) {
      if(nodes[i].name && nodes[i].name!=='') {
        if(q++!==0) {
          query += "&";
        }
        query += nodes[i].name+"="+escape(nodes[i].value);
      }
    }
    req(query,"get",null);
    return false;
  }

  function httpPost(e) {
    var form, nodes, data;

    data = {};
    form = e.target;
    nodes = d.tags("input",form);
    for(i=0,x=nodes.length;i<x;i++) {
      if(nodes[i].name && nodes[i].name!=='') {
        data[nodes[i].name]=nodes[i].value+"";
      }
    }
    req(form.action,'post',JSON.stringify(data));
    return false;
  }

  function httpPut(e) {
    var form, nodes, data;

    data = {};
    form = e.target;
    nodes = d.tags("input",form);
    for(i=0,x=nodes.length;i<x;i++) {
      if(nodes[i].name && nodes[i].name!=='') {
        data[nodes[i].name]=nodes[i].value+"";
      }
    }
    req(form.action,'put',JSON.stringify(data));
    return false;
  }
// *** EOD ***

  function httpDelete(e) {
    if(confirm("Ready to delete?")===true) {
      req(e.target.href, "delete", null);
    }
    return false;
  }

  // low-level HTTP stuff
  function req(url, method, body) {
    var ajax = new XMLHttpRequest();
    ajax.onreadystatechange = function(){rsp(ajax)};
    ajax.open(method, url);
    ajax.setRequestHeader("accept",g.atype);
    if(body && body!==null) {
      ajax.setRequestHeader("content-type", g.ctype);
    }
    ajax.send(body);
  }

  function rsp(ajax) {
    if(ajax.readyState===4) {
      g.msg = JSON.parse(ajax.responseText);
      parseMsg();
    }
  }

  // export function
  var that = {};
  that.init = init;
  return that;
}


