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
            minHeight: 0
        });

        // DEBUG
        setTimeout(() => {
            $("#menu-navbar").show();
            openStoryPane();
        }, 1000)
    }, 500);
});

// Handle parcel identification
let parcelMarker = null;
webmap._map.on('click', (e) => {
    $("#parcel-owner").text("Loading...");
    $("#parcel-use").text("Loading...");
    $("#parcel-value").text("Loading...");
    $("#parcel-info-container").hide();
    $("#parcel-info-loading").show();
    $("#map-info").show();

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
    $("#map-info").hide();
});

// Generate link to Google Maps
$("#parcel-google-maps").click(() => {
    window.open("https://www.google.com/maps/@" + $("#info-body").attr("data-xy") + ",200m/data=!3m1!1e3");
});

function openStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({left: 0});
        $("#map-box").animate({left: "40vw"});
    } else {
        $("#story-box").animate({bottom: 0});
        $("#map-box").animate({bottm: "50vh"});
    }
}

function closeStoryPane() {
    if ($(window).width() >= 1000) {
        $("#story-box").animate({left: "-40vw"});
        $("#map-box").animate({left: 0});
    } else {
        $("#story-box").animate({bottom: "-50vh"});
        $("#map-box").animate({bottm: 0});
    }
}


$("#story-close").click(closeStoryPane);