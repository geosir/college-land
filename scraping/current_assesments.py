import json
import requests

with open("../data/CAMBRIDGE_PARCELS_FY2019.geojson") as f:
    data = json.load(f)

print(len(data['features']), "features")

for feature in data['featuers']:
    print(feature.keys())
