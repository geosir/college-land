import json
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
import time
from datetime import datetime


def wait_cond(condition_fxn, pause=1, tries=600):
    for _ in range(tries):
        if not condition_fxn():
            time.sleep(pause)
        else:
            return

    raise Exception("Page load timeout.")


def wait_element(classname, pause=1, tries=600):
    return wait_cond(lambda: len(driver.find_elements_by_class_name(classname)) > 0, pause=pause, tries=tries)


driver = None


def init_driver():
    global driver
    options = Options()
    # options.headless = True
    driver = webdriver.Firefox(options=options)


print("=============================================")
print("CollegeLand Cambridge Ownership Scrape Merger")
print("Copyright (c) 2019 George Moe")
print("=============================================")

print("Loading driver...")
init_driver()

print("Loading Parcels...")
# parcel_file = "../data/CAMBRIDGE_PARCELS_FY2019.geojson"
parcel_file = "properties_merged_2-78_20190415.geojson"
with open(parcel_file) as f:
    data = json.load(f)
print("Found", len(data['features']), "features")

start_property = 78
print("Starting at property", start_property, "- Estimated scrape time:",
      round((len(data['features']) - start_property + 1) * 6 / 3600, 2), "hours.")

input("Press ENTER to start scrape.")

print("========= SCRAPE START =========")
try:
    counter = 0
    for feature in data['features'][start_property - 1:]:
        try:
            print("=== PROPERTY", feature['id'], ":", feature['properties']['MAP'], "-", feature['properties']['LOT'])
            print(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

            feature['properties']['units'] = []

            print("--> Get Property Search Form")
            driver.get("https://www.cambridgema.gov/propertydatabase")
            wait_cond(lambda: "Property Database" in driver.title)

            print("--> Enter Property ID")
            elem = driver.find_element_by_name("bodycontent_0$txtAdvBlockNum")
            elem.send_keys(feature['properties']['MAP'])
            elem = driver.find_element_by_name("bodycontent_0$txtAdvLotNum")
            elem.send_keys(feature['properties']['LOT'])
            elem.send_keys(Keys.RETURN)

            wait_cond(lambda: ("Search Again" in driver.page_source or
                               driver.find_elements_by_id("bodycontent_0_lblNoResults")))
            if driver.find_elements_by_id("bodycontent_0_lblNoResults"):
                print("--> PROPERTY NOT FOUND.")
                feature['properties']['merge_error'] = "NOT FOUND"
                continue

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

            for page in inspect_queue:
                unitdata = {}
                print("--> Inspect", page)

                url = page
                if page != "THIS":
                    driver.get(page)
                else:
                    url = driver.current_url
                wait_cond(lambda: driver.find_elements_by_id("bodycontent_0_PropertyDetailPanel"))
                inforows = driver.find_element_by_id("bodycontent_0_PropertyDetailPanel").find_element_by_class_name(
                    "leftCol").find_elements_by_tag_name("tr")

                print("--> Getting data...")
                fieldcount = 0
                for row in inforows:
                    if not (row.find_elements_by_tag_name("th") and row.find_elements_by_tag_name("td")):
                        continue

                    key = row.find_element_by_tag_name("th")
                    value = row.find_element_by_tag_name("td")
                    # print(key.text, ":", value.text)
                    print(".", end="")
                    unitdata[key.text] = value.text
                    fieldcount += 1
                print()
                print("    --> Found", fieldcount, "fields.")

                # Get images
                unitdata['images'] = [image.get_attribute("src") for image in
                                      driver.find_elements_by_class_name("propertyImage")]
                print("    --> Found", len(unitdata['images']), "images.")

                # Get sketches
                unitdata['sketches'] = []
                if driver.find_elements_by_id("bodycontent_0_pnlSketches"):
                    unitdata['sketches'] = [image.get_attribute("src") for image in driver.find_element_by_id(
                        "bodycontent_0_pnlSketches").find_elements_by_tag_name("img")]
                print("    --> Found", len(unitdata['sketches']), "sketches.")

                feature['properties']['units'].append(unitdata)

                print("--> (Backoff)")
                time.sleep(1)

            print("---> Uniting key data...")
            for field in ['Property Class', 'Assessed Value', 'Owner(s)']:
                value = feature['properties']['units'][0][field]
                print(field, ":", value)
                feature['properties'][field] = value

        except Exception as e:
            print("EXCEPTION:", type(e).__name__, ":", e)
            feature['properties']['merge_error'] = "{}: {}".format(type(e).__name__, e)
            print("Skipping...")
        finally:
            print("--> (Backoff)")
            time.sleep(1)
            counter += 1

            if counter % 100 == 0:
                print("Writing data to file...")
                with open('properties_merged.geojson', 'w') as outfile:
                    json.dump(data, outfile)

                print("--> Reset driver to mitigate memory leak.")
                driver.quit()
                init_driver()



except Exception as e:
    print("TOP-LEVEL EXCEPTION:", type(e).__name__, ":", e)
except KeyboardInterrupt:
    print("Stop.")
finally:
    print("Writing data to file...")
    with open('properties_merged.geojson', 'w') as outfile:
        json.dump(data, outfile)
    print("Done!")

    driver.quit()
