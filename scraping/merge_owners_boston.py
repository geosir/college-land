import csv
import json

print("Reading usages into dict...")
usagef = open("../data/BOSTON_PROPERTY_USE.txt")
usages = {}
try:
    while True:
        value = next(usagef).strip()
        use = next(usagef).strip()
        # print(value, use)
        usages[int(value)] = use
except StopIteration:
    pass

print("Reading assessments into dict...")
assess = open("../data/fy19fullpropassess.csv")
reader = csv.DictReader(assess)
assess_dict = {}
for row in reader:
    if row['PID'] not in assess_dict:
        assess_dict[row['PID']] = []
    assess_dict[row['PID']].append(row)

assess.close()

print("Reading parcels into dict...")
with open("../data/BOSTON_PARCELS_2018.geojson") as f:
    parcels = json.load(f)

print("Merging data...")
total = len(parcels['features'])
count = 0
for feature in parcels['features']:
    count += 1
    if count % 1000 == 0:
        print("PROGRESS:", count, '/', total)

    if 'PID_LONG' not in feature['properties']:
        continue
    if feature['properties']['PID_LONG'] not in assess_dict:
        continue
    assessment = assess_dict[feature['properties']['PID_LONG']]
    feature['properties']['OWNER'] = assessment[0]['OWNER']
    feature['properties']['MAIL_ADDRESSEE'] = assessment[0]['MAIL_ADDRESSEE']
    feature['properties']['AV_TOTAL'] = assessment[0]['AV_TOTAL']
    feature['properties']['PTYPE'] = assessment[0]['PTYPE']
    if int(assessment[0]['PTYPE']) in usages:
        feature['properties']['PTYPE_HUMAN'] = usages[int(assessment[0]['PTYPE'])]
    else:
        feature['properties']['PTYPE_HUMAN'] = "UNKNOWN"
    # feature['properties']['units'] = assessment

# with open("BOSTON_PARCELS_OWNERS_MERGED_2019.geojson", 'w') as f:
with open("BOSTON_PARCELS_OWNERS_MERGED_KEYFEATURES_2019.geojson", 'w') as f:
    json.dump(parcels, f)
