var original_xmlhttprequest_open = XMLHttpRequest.prototype.open;

function loadHandler(e) {
  if (this.readyState === this.DONE && this.status >= 200 && this.status < 300) {
    window.postMessage({
        kibana_es_response: this.responseText
    }, "*");
  }
};

XMLHttpRequest.prototype.open = function() {
  var method = arguments[0];
  var url = arguments[1];
  if (/POST/i.test(method) && /https:\/\/kibana.logit.io\/.*\/elasticsearch\/_msearch/.test(url)) {
    this.addEventListener("load", loadHandler);
  }
  original_xmlhttprequest_open.apply(this, arguments);
};
