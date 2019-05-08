const rootPath = "/unitopia";

function swapCoords(coords) {
    return coords.map((c) => [c[1], c[0]])
}

// Load ESRI Webmap
const webmapID = '6fda7e2ca6c440e59a20805c563faa60';
const webmap = L.esri.webMap(webmapID, {
    map: L.map("map", {
        zoomControl: false,
        maxNativeZoom: 16,
        minZoom: 12,
        maxZoom: 18
    })
});

webmap.on('load', function () {
    // Add layers toggle button
    let overlayMaps = {};
    webmap.layers.map(function (l) {
        if (!l.title.includes("World")) overlayMaps[l.title] = l.layer;
        if (l.title.includes("World")) {
            l.layer.options.maxNativeZoom = 16;
        }
    });
    L.control.layers({}, overlayMaps, {
        position: 'bottomleft'
    }).addTo(webmap._map);

    // Animate cover
    setTimeout(() => {
        $("#header-loading").hide(100);
        $("#map-header").css({
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            minHeight: "10vh"
        });

        setTimeout(() => {
            $("#menu-navbar").show();
            handlePath(window.location.pathname);
        }, 1000)
    }, 500);
});

// Handle parcel identification
let parcelMarker = null;
let clickMarker = null;
webmap._map.on('click', (e) => {
    $("#clickinfo").text(e.latlng);

    // Draw click location
    if (clickMarker) webmap._map.removeLayer(clickMarker);
    clickMarker = L.marker(e.latlng).addTo(webmap._map);

    $("#parcel-owner").text("Loading...");
    $("#parcel-use").text("Loading...");
    $("#parcel-value").text("Loading...");
    $("#parcel-info-container").hide();
    $("#parcel-info-loading").show();
    openInfoPane();

    // Query Cambridge
    const cambridgeQuery = new Promise((resolve, reject) => {
        L.esri.query({
            url: 'https://services1.arcgis.com/qN3V93cYGMKQCOxL/arcgis/rest/services/Cambridge_Land_Use_2019_(LBCS)/FeatureServer/0',
        }).contains(e.latlng).run(function (error, featureCollection) {
            console.log("Cambridge", featureCollection);
            if (featureCollection) {
                const features = featureCollection.features.filter((f) => f.geometry);
                if (features.length > 0) {
                    const feature = features[0];
                    const props = feature.properties;
                    $("#parcel-owner").text(props.Owner_s_);
                    $("#parcel-use").text(props.Property_Class);
                    $("#parcel-value").text(props.Assessed_Value);

                    resolve(feature);
                } else {
                    resolve(0);
                }
            } else {
                console.error("FEATURE QUERY ERROR (Cambridge 2019):", error);
                reject(error);
            }
        });
    });

    // Query Boston
    const bostonQuery = new Promise((resolve, reject) => {
        L.esri.query({
            url: 'https://services1.arcgis.com/qN3V93cYGMKQCOxL/arcgis/rest/services/Boston_Land_Use_2019_(LBCS)/FeatureServer/0',
        }).contains(e.latlng).run(function (error, featureCollection) {
            console.log("Boston", featureCollection);
            if (featureCollection) {
                const features = featureCollection.features.filter((f) => f.geometry);
                if (features.length > 0) {
                    const feature = features[0];
                    const props = feature.properties;
                    $("#parcel-owner").text(props.OWNER + "; " + props.MAIL_ADDRESSEE);
                    $("#parcel-use").text(props.PTYPE_HUMAN);
                    $("#parcel-value").text("$" + props.AV_TOTAL.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));

                    resolve(feature);
                } else {
                    resolve(0);
                }
            } else {
                console.error("FEATURE QUERY ERROR (Boston 2019):", error);
                reject(error);
            }
        });
    });

    // Draw queried parcel or handle empty result
    Promise.all([cambridgeQuery, bostonQuery]).then((result) => {
        if (parcelMarker) {
            webmap._map.removeLayer(parcelMarker);
        }

        const valid = result.filter((e) => e);
        if (valid.length > 0) {
            $("#info-body").attr("data-xy", e.latlng.lat + "," + e.latlng.lng);

            parcelMarker = L.polygon(swapCoords(valid[0].geometry.coordinates[0]), {
                color: 'red',
                weight: 5
            }).addTo(webmap._map);
            webmap._map.addLayer(parcelMarker);
        } else {
            $("#parcel-owner").text("No data.");
            $("#parcel-use").text("No data.");
            $("#parcel-value").text("No data.");
        }
        $("#parcel-info-loading").hide();
        $("#parcel-info-container").show();
    })
});

// Handle parcel panel close
$("#parcel-close").click(() => {
    closeInfoPane();
});

// Generate link to Google Maps
$("#parcel-gmaps-button").click(() => {
    window.open("https://www.google.com/maps/place/" + $("#info-body").attr("data-xy") + "/@" + $("#info-body").attr("data-xy") + ",200m/data=!3m1!1e3");
});

function openInfoPane() {
    if ($(window).width() >= 1000) {
        $("#map-info").animate({right: 0});
    } else {
        $("#map-info").animate({bottom: 0});
    }
}

function closeInfoPane() {
    if ($(window).width() >= 1000) {
        $("#map-info").animate({right: "-25vw"});
    } else {
        $("#map-info").animate({bottom: "-40vh"});
    }
}

function openStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({left: 0});
        $("#map-box").animate({left: "33vw"}).promise().done(() => {
            webmap._map.invalidateSize()
        });
    } else {
        $("#story-box").animate({bottom: 0});
        $("#map-box").animate({bottom: "50vh"}).promise().done(() => {
            webmap._map.invalidateSize()
        });
    }
    $("#story-box").attr("open", true)
}

function closeStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({width: "33vw", left: "-33vw"});
        $("#map-box").animate({left: 0}).promise().done(() => {
            webmap._map.invalidateSize()
        });
    } else {
        $("#story-box").animate({height: "50vh", bottom: "-50vh"});
        $("#map-box").animate({bottom: 0}).promise().done(() => {
            webmap._map.invalidateSize()
        });
    }
    $("#story-box").removeAttr("open")
}

function expandStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({width: "100vw"});
    } else {
        $("#story-box").animate({height: "100vh"});
    }
    $("#story-box").attr("expanded", true);
    $("#story-shrink").show();
    $("#story-expand").hide();
}

function shrinkStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({width: "33vw"});
    } else {
        $("#story-box").animate({height: "50vh"});
    }
    $("#story-box").removeAttr("expanded");
    $("#story-expand").show();
    $("#story-shrink").hide();
}

// Close story pane
$("#story-close").click(closeStoryPane);

// Expand story pane
$("#story-expand").click(expandStoryPane);

// Shrink story pane
$("#story-shrink").click(shrinkStoryPane);

const pages = {
    "/welcome": {
        type: "page",
        name: "Welcome",
        href: "/pages/welcome.html",
        next: "/homes"
    },
    "/homes": {
        type: "page",
        name: "Harvard and Home",
        href: "/pages/homes.html",
        prev: "/welcome",
        next: "/allston"
    },
    "/allston": {
        type: "page",
        name: "Arranging Allston",
        href: "/pages/allston.html",
        prev: "/homes",
        next: "/conclusions"
    },
    "/conclusions": {
        type: "page",
        name: "Conclusions",
        href: "/pages/conclusions.html",
        prev: "/allston",
        next: "/methods"
    },
    "/methods": {
        type: "page",
        name: "Methods",
        href: "/pages/methods.html",
        prev: "/conclusions",
        next: "/references"
    },
    "/references": {
        type: "page",
        name: "References",
        href: "/pages/references.html",
        prev: "/methods",
        next: "/about"
    },
    "/about": {
        type: "page",
        name: "About Unitopia",
        href: "/pages/about.html",
        prev: "/references",
    }
};

function handlePath() {
    console.log("CURRENT URL:", window.location);

    let path = window.location.pathname;
    let searchParams = new URLSearchParams(window.location.search);
    const hasp = Boolean(searchParams.get("p"));
    const hash = Boolean(window.location.hash);
    if (hasp) path = searchParams.get("p");
    path = path.replace(rootPath, "").trim();
    if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
    if (path === "/" || path === "") openPath("/welcome", window.location.hash, hasp);
    else openPath(path, window.location.hash, hasp || hash);
}

function focus(path, hash = "", replace = false) {
    if (!pages[path]) return false;
    if (replace) window.history.replaceState({
        name: pages[path].name,
        type: "page"
    }, pages[path].name, rootPath + path + hash);
    else window.history.pushState({
        name: pages[path].name,
        type: "page"
    }, pages[path].name + " " + hash, rootPath + path + hash);
    if (hash) window.location.hash = hash;
}

function openPath(path, hash = "", replace = false) {
    console.log("Open:", path);
    if (!pages[path]) return false;
    $("#story-content").hide();
    $("#story-loading").show();
    console.log("Query:", rootPath + pages[path].href);
    $.get(rootPath + pages[path].href, (response) => {
        $("#story-loading").hide();
        if (response.search("404POISON") > -1) {
            $("#story-content").show();
            return;
        }
        $("#story-content").html(response);
        $("#story-content").ready(() => {
            if (pages[path].prev && pages[pages[path].prev]) {
                $("#story-prev-name").text(pages[pages[path].prev].name);
                $("#story-prev").attr("data-target", pages[path].prev);
                $("#story-prev").show();
            } else {
                $("#story-prev").hide();
            }
            if (pages[path].next && pages[pages[path].next]) {
                $("#story-next-name").text(pages[pages[path].next].name);
                $("#story-next").attr("data-target", pages[path].next);
                $("#story-next").show();
            } else {
                $("#story-next").hide();
            }

            if (rebindGallerize) rebindGallerize();
            rebindMapcenterButtons();
            rebindStoryLinks();
            $("#story-content").show();
            if (!$("#story-box").attr("open")) {
                openStoryPane();
            }
            focus(path, hash, replace);
        });
    });
}

function rebindMapcenterButtons() {
    $(".story-mapcenter-button").off("click");
    $(".story-mapcenter-button").click(function () {
        const xy = $(this).attr("data-xy").split(",");
        webmap._map.flyTo(new L.latLng(...xy), 17);
        webmap._map.fireEvent('click', {latlng: new L.latLng(...xy)});
    });
}

function rebindStoryLinks() {
    $(".story-link").off("click");
    $(".story-link").click(function () {
        openPath($(this).attr("data-target"), $(this).attr("data-hash") || "");
    });
}

$(".nav-link").click(function () {
    $('.navbar-collapse').collapse('hide');
    openPath($(this).attr("data-target"), $(this).attr("data-hash") || "");
});

window.onpopstate = () => {
    handlePath();
};

$("#toggle-legend").click(() => {
    const $legend = $("#map-legend");
    if ($legend.is(":visible")) {
        $legend.hide();
    } else {
        $legend.show()
    }
});

$("#story-prev, #story-next").click(function () {
    const target = $(this).attr("data-target");
    if (target) openPath(target);
});