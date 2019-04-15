import json
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
import time


def wait_cond(condition_fxn, pause=1, tries=60):
    for _ in range(tries):
        if not condition_fxn():
            time.sleep(pause)
        else:
            return

    raise Exception("Page load timeout.")


def wait_element(classname, pause=0.5, tries=600):
    return wait_cond(lambda: len(driver.find_elements_by_class_name(classname)) > 0, pause=pause, tries=tries)


print("=============================================")
print("CollegeLand Cambridge Ownership Scrape Merger")
print("Copyright (c) 2019 George Moe")
print("=============================================")

print("Loading driver...")
options = Options()
# options.headless = True
driver = webdriver.Firefox(options=options)

print("Loading Parcels...")
with open("../data/CAMBRIDGE_PARCELS_FY2019.geojson") as f:
    data = json.load(f)
print("Found", len(data['features']), "features")

input("Press ENTER to start scrape.")

print("========= SCRAPE START =========")
try:
    for feature in data['features'][1:]:
        print("=== PROPERTY", feature['id'], ":", feature['properties']['MAP'], "-", feature['properties']['LOT'])

        print("--> Get Property Search Form")
        driver.get("https://www.cambridgema.gov/propertydatabase")
        wait_cond(lambda: "Property Database" in driver.title)

        print("--> Enter Property ID")
        elem = driver.find_element_by_name("bodycontent_0$txtAdvBlockNum")
        elem.send_keys(feature['properties']['MAP'])
        elem = driver.find_element_by_name("bodycontent_0$txtAdvLotNum")
        elem.send_keys(feature['properties']['LOT'])
        elem.send_keys(Keys.RETURN)

        wait_cond(lambda: "Search Again" in driver.page_source)

        print("--> Result: ", end="")
        inspect_queue = []
        if driver.find_elements_by_id("bodycontent_0_gvSearchResults"):
            print("Multiple properties.")
            table = driver.find_element_by_id("bodycontent_0_gvSearchResults")
            for link in table.find_elements_by_tag_name("a"):
                href = link.get_attribute("href")
                if "propertydatabase/" in href:
                    print("    --#", href)
                    inspect_queue.append(href)
        else:
            print("Single property.")
            inspect_queue.append("THIS")

        feature['properties']['units'] = []
        for page in inspect_queue:
            unitdata = {}
            print("--> Inspect", page)

            if page != "THIS":
                driver.get(page)
            wait_cond(lambda: driver.find_elements_by_id("bodycontent_0_PropertyDetailPanel"))
            info = driver.find_element_by_id("bodycontent_0_PropertyDetailPanel").find_element_by_class_name("leftCol")

            print("--> Getting data...")
            for row in info.find_elements_by_tag_name("tr"):
                if not (row.find_elements_by_tag_name("th") and row.find_elements_by_tag_name("td")):
                    continue

                key = row.find_element_by_tag_name("th")
                value = row.find_element_by_tag_name("td")
                # print(key.text, ":", value.text)
                unitdata[key.text] = value.text

            unitdata['images'] = [image.get_attribute("src") for image in
                                  driver.find_elements_by_class_name("propertyImage")]

            feature['properties']['units'].append(unitdata)

            print("--> (Backoff)")
            time.sleep(1)

        print("---> Uniting key data...")
        for field in ['Property Class', 'Assessed Value', 'Owner(s)']:
            value = feature['properties']['units'][0][field]
            print(field, ":", value)
            feature['properties'][field] = value

        print("--> (Backoff)")
        time.sleep(1)

except Exception as e:
    print("EXCEPTION:", type(e).__name__, ":", e)
except KeyboardInterrupt:
    print("Stop.")

print("Writing data to file...")
with open('properties_merged.geojson', 'w') as outfile:
    json.dump(data, outfile)
print("Done!")
