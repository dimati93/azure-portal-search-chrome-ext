// common functions
const encodeXML = str =>
  str.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
    }
  });

const propCompare = propSelector => (a, b) => {
  var propA = propSelector(a);
  var propB = propSelector(b);

  return propA == propB ? 0 : (propA > propB) ? 1 : -1;
}

const split3 = (index, length) => x => [x.slice(0, index), x.slice(index, index + length), x.slice(index + length)];

const openUrl = (url) => chrome.tabs.create({ url: url });

// page caches
var resources;
var tenant;

chrome.omnibox.onInputStarted.addListener(
  async function () {
    await fetch("https://resources.azure.com/api/tenants", { credentials: 'include' })
      .then(r => r.json())
      .then(json => tenant = json);

    resources = fetch("https://resources.azure.com/api/search?keyword=", { credentials: 'include' })
      .then(r => r.json())
      .then(json => json.sort(propCompare(x => x.name)));
  });

chrome.omnibox.onInputChanged.addListener(
  function (text, suggest) {
    if (!resources)
      return;

    resources.then(r => {
      var searchResult = r
        .map(x => { return { name: x.name, id: x.id, matchIndex: x.name.toUpperCase().indexOf(text.toUpperCase()) } })
        .filter(x => x.matchIndex > -1)
        .slice(0, 9);

      var toSearchSuggestion = function (apiResult) {
        var matchSplit = split3(apiResult.matchIndex, text.length)(apiResult.name)

        return {
          content: apiResult.id,
          description: `${encodeXML(matchSplit[0])}<match>${encodeXML(matchSplit[1])}</match>${encodeXML(matchSplit[2])}`,
          deletable: false
        }
      }

      suggest(searchResult.map(toSearchSuggestion));
    });
  });

chrome.omnibox.onInputEntered.addListener(
  function (text) {
    var currentDomain = tenant.filter(x => x.Current)[0].DomainName;
    var portalUrl = resourceId => `https://portal.azure.com/#@${currentDomain}/resource${resourceId}`
    var searchHubUrl = searchText => `https://portal.azure.com/#blade/HubsExtension/Resources/resourceType/Microsoft.Resources%2Fresources/filter/${searchText}`;

    resources.then(r => {
      if (r.some(x => x.id == text)) {
        openUrl(portalUrl(text));
        return;
      }

      openUrl(searchHubUrl(text));
    });
  });
