function humanFileSize(size) {
  var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function humantTime(ms) {
  const seconds = Math.floor(Math.abs(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  const t = [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s]
    .filter(Boolean)
    .join(':')
  return ms < 0 && seconds ? `-${t}` : t
}

function openPopup(id) {
    if (document.getElementById(id).style.display =="block"){
      return closePopup(id);
    }
    document.getElementById(id).style.display = "block";
}
  
function closePopup(id) {
    document.getElementById(id).style.display = "none";
}
  
function tableFromKeys(table, keys){
  let thead = table.createTHead();
  let row = thead.insertRow();
  console.log(keys);
  for (let key of keys) {
    console.log(key);
    let th = document.createElement("th");
    th.setAttribute("scope", "col")
    let text = document.createTextNode(key[1]);
    th.appendChild(text);
    row.appendChild(th);
  }
}
  
function tableGenerate(table, keys, data){
  for (let element of data) {
    let row = table.insertRow();
    row.setAttribute("scope", "row")
    for (let key of keys){
      let cell = row.insertCell();
      if (key[2] != null){
        let text = document.createTextNode(key[2](element[key[0]]));
        cell.appendChild(text);
      }
      else{
        let text = document.createTextNode(element[key[0]]);
        cell.appendChild(text);
      }
    }
  }
}
  
function tableClear(table){
  while ( table.rows.length > 1 ){
    table.deleteRow(1);
  }
}

function createInput({tp = 'text', id = null, cls = null, val = null, clk=null} = {}){
  var input = document.createElement("input");
  input.setAttribute('type', tp);
  if (id != null){
      input.setAttribute('id', id);
  }
  if (cls != null){
      input.setAttribute('class', cls);
  }
  if (val != null){
      input.setAttribute('value', val);
  }
  if (clk != null){
      input.setAttribute('onclick', clk);
  }
  
  return input
}

function json(method, theUrl, data, callback) {
  let xmlHttpReq = new XMLHttpRequest();
  xmlHttpReq.onreadystatechange = function () {
    console.log(xmlHttpReq.responseText);
    if (xmlHttpReq.readyState == 4){
      callback(xmlHttpReq.status, JSON.parse(xmlHttpReq.responseText));

    }
      
  }
  xmlHttpReq.open(method, theUrl, true); // true for asynchronous 
  if (data != null){
    xmlHttpReq.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xmlHttpReq.send(JSON.stringify(data));
  }
  else{
    xmlHttpReq.send(null);
  }
}
  
  
function parseMediaType(mediaType){
  if(mediaType == "0"){
    return "Film"
  }
  else if (mediaType == "1"){
    return "Episode"
  }
  else{
    return "Inconu"
  }
}

const removeChilds = (parent) => {
  while (parent.lastChild) {
    parent.removeChild(parent.lastChild);
  }
};
  
function get_select(id){
  var select = document.getElementById(id);
  return select.options[select.selectedIndex].value;
}

function connect(){
  var user = document.getElementById("login-user").value;
  var password = document.getElementById("login-password").value;
  json("POST", "/system/user", {"user": user, "password": password}, function(status, result){
    console.log(status, result);
    //window.location.reload(true)
  });
}

function disconnect(){
  json("POST", "/system/user", {"user": "", "password": ""}, function(status, result){
    console.log(status, result);
    //window.location.reload(true)
  });
}

function string_validator(str) {
  return !/[^\u0000-\u00ff]/g.test(str);
}