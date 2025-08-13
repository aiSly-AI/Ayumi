# pylint: disable=missing-module-docstring, missing-class-docstring, missing-function-docstring, fixme

# Import Modules
import os
import re
import json
import time
import uuid
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By

from selenium_stealth import stealth


###############################################################################


class ScrapNautiljonException(Exception):
    pass


class ScrapMangaNautiljon:
    def __init__(self, query:str|None = None, debug:bool = False) -> None:
        if query is None:
            # TODO: Raise an exception + log
            return

        self.__base_url = "https://www.nautiljon.com/"
        self.__url_search = "search.php?cx=partner-pub-016984106292057030987%3Ayj-tngtyvhq\
            &cof=FORID%3A10&ie=UTF-8&q="
        self.__url = f"{self.__base_url}{self.__url_search}{query.replace(' ', '+')}"

        self.__first_page = ""

        self.__query = query
        self.__debug = debug

        self.__driver: webdriver.Chrome
        self.__data = {}

        self.__data_folder = "./data"

        self.__set_driver()

    def __set_driver(self) -> None:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
            AppleWebKit/537.36 (KHTML, like Gecko) \
            Chrome/58.0.3029.110 Safari/537.3"

        options = webdriver.ChromeOptions()

        if not self.__debug:
            options.add_argument("--headless")

        options.add_argument(f'user-agent={user_agent}')

        options.add_experimental_option("detach", True)
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)

        self.__driver = webdriver.Chrome(options=options)

        stealth(self.__driver,
            languages=["en-US", "en"],
            vendor="Google Inc.",
            platform="Win32",
            webgl_vendor="Intel Inc.",
            renderer="Intel Iris OpenGL Engine",
            fix_hairline=True,
        )

    def __create_folder(self, manga_title:str) -> None:
        os.makedirs(self.__data_folder, exist_ok=True)

        folders = os.listdir(self.__data_folder)
        is_folder_exist = False

        for folder in folders:
            print(f"Folder: {folder} - Query: {self.__query}")
            if re.search(manga_title, folder, re.IGNORECASE):
                is_folder_exist = True
                break

        if not is_folder_exist:
            manga_folder = os.path.join(self.__data_folder, manga_title)
            print(f"Creating folder: {manga_folder}")
            os.makedirs(manga_folder, exist_ok=True)

    def __go_to_manga_page(self) -> None:
        self.__driver.get(self.__url)
        self.__driver.find_element(By.ID, "didomi-notice-agree-button").click()
        time.sleep(1)

        link = ""

        manga_blocks = self.__driver.find_elements(By.CLASS_NAME, "gs-webResult.gs-result")

        found = False
        for manga_block in manga_blocks:
            child_elements = manga_block.find_elements(By.XPATH, ".//*")
            for child in child_elements:
                if re.search("mangas", child.text, re.IGNORECASE):
                    link = manga_block.find_element(By.TAG_NAME, "a").get_attribute("href")
                    if link is None:
                        raise ScrapNautiljonException("Link not found")

                    found = True
                    break

            if found:
                break

        if not link:
            raise ScrapNautiljonException("Manga link not found")

        link = link.strip()
        self.__data.update({ "link": link })

        self.__first_page = link

        self.__driver.execute_script(f'''window.open("{link}","_blank");''')
        self.__driver.switch_to.window(self.__driver.window_handles[1])
        time.sleep(1)

    def __scrap_manga_title(self) -> str:
        manga_title = None
        div_title = self.__driver.find_element(By.CLASS_NAME, "frame_left_top")
        spans = div_title.find_elements(By.TAG_NAME, "span")

        for span in spans:
            if span.get_attribute("itemprop") == "name":
                manga_title = span.text

        if manga_title is None:
            manga_title = self.__query

        manga_title = manga_title.strip()

        self.__create_folder(manga_title)
        self.__data.update({ "title": manga_title })

        return manga_title

    def __scrap_manga_infos(self) -> None:
        title_alternative = None

        spans = self.__driver.find_elements(By.TAG_NAME, "span")
        for span in spans:
            if span.get_attribute("itemprop") == "alternateName":
                title_alternative = span.text
                self.__data.update({ "title alternatif": title_alternative })

            if span.get_attribute("class") == "bold":
                if re.search("titre original", span.text, re.IGNORECASE):
                    title_original = span.find_element(By.XPATH, "..").text.split(" / ")[0].strip()
                    title_original = title_original.replace("Titre original : ", "").strip()
                    title_japanese = span.find_element(By.XPATH, "..").text.strip()

                    if re.match(r'/', title_japanese):
                        title_japanese = title_japanese.split(" / ")[1].strip()

                    self.__data.update({
                        "title original": title_original,
                        "title japonais": title_japanese
                    })

        volumes = self.__driver.find_element(By.ID, "edition_0-1")
        mangas = volumes.find_elements(By.CLASS_NAME, "unVol")

        link_manga = mangas[0].find_element(By.TAG_NAME, "a").get_attribute("href")
        if link_manga is None:
            raise ScrapNautiljonException("Link Manga not found")

        link_manga = link_manga.strip()
        self.__driver.get(link_manga)
        time.sleep(1)

        infos = self.__driver.find_elements(By.CLASS_NAME, "liste_infos")
        for info in infos:
            ul = info.find_element(By.TAG_NAME, "ul")

            for li in ul.find_elements(By.TAG_NAME, "li"):
                if re.search("titre alternatif", li.text, re.IGNORECASE):
                    title_alternative = li.text.split(":")[1].split(" / ")[0].strip()
                    self.__data.update({ "titre alternatif": title_alternative })

                if re.search("titre original", li.text, re.IGNORECASE):
                    title_original = li.text.split(":")[1].split(" / ")[0].strip()
                    self.__data.update({ "titre original": title_original })

                if re.search("Nb volumes VO", li.text, re.IGNORECASE):
                    nb_volumes_vo = li.text.split(":")[1].strip()
                    self.__data.update({ "Nb volumes VO": nb_volumes_vo })

                if re.search("Nb volumes VF", li.text, re.IGNORECASE):
                    nb_volumes_vf = li.text.split(":")[1].strip()
                    self.__data.update({ "Nb volumes VF": nb_volumes_vf })

            dates = info.find_element(By.CLASS_NAME, "nav_vols.fright")
            divs = dates.find_elements(By.TAG_NAME, "div")

            title_last_out = divs[0].find_element(By.TAG_NAME, "a").get_attribute("title")
            if title_last_out is None:
                raise ScrapNautiljonException("Title Last Out not found")

            title_last_out = title_last_out.strip()

            date = divs[0].find_element(By.TAG_NAME, "span").text
            date = date.strip()

            self.__data.update({
                "last_out": {
                    "title": title_last_out,
                    "date": date
                }
            })

            title_soon_out = divs[1].find_element(By.TAG_NAME, "a").get_attribute("title")
            if title_soon_out is None:
                raise ScrapNautiljonException("Title Soon Out not found")

            title_soon_out = title_soon_out.strip()

            date = divs[1].find_element(By.TAG_NAME, "span").text
            date = date.strip()

            self.__data.update({
                "soon_out": {
                    "title": title_soon_out,
                    "date": date
                }
            })

    def __scrap_manga_volumes(self) -> list[str]:
        volumes = self.__driver.find_element(By.ID, "edition_0-1")
        mangas = volumes.find_elements(By.CLASS_NAME, "unVol")

        navigation_links = []
        self.__data.update({ "volumes": {} })

        last_num_out = int(self.__data["last_out"]["title"].split(" ")[-1])

        for i, manga in enumerate(mangas):
            link_manga = manga.find_element(By.TAG_NAME, "a").get_attribute("href")
            if link_manga is None:
                raise ScrapNautiljonException("Link Manga not found")

            link_manga = link_manga.strip()

            out = True
            if i + 1 > last_num_out:
                out = False

            navigation_links.append(link_manga)
            self.__data["volumes"].update({
                f"volume_{i + 1}": {
                    "link": link_manga,
                    "is_out": out
                }
            })

        return navigation_links

    def __scrap_manga_volumes_img(self, navigation_links:list[str]) -> None:
        for i, link in enumerate(navigation_links):
            self.__driver.execute_script(f'''window.open("{link}","_blank");''')

            idx = len(self.__driver.window_handles) - 1

            self.__driver.switch_to.window(self.__driver.window_handles[idx])
            time.sleep(1)

            img_src = self.__driver.find_element(
                By.ID, "onglets_3_couverture"
            ).get_attribute("href")
            if img_src is None:
                raise ScrapNautiljonException("Image not found")

            img_src = img_src.strip()
            self.__data["volumes"][f"volume_{i + 1}"].update({ "img_src": img_src })

            self.__driver.close()

            idx = len(self.__driver.window_handles) - 1
            self.__driver.switch_to.window(self.__driver.window_handles[idx])

            if i + 1 < len(navigation_links):
                print(f"progress: {i + 1}/{len(navigation_links)}", flush=True)
            else:
                print(f"final: {i + 1}/{len(navigation_links)}", flush=True)

    def __write_data(self, manga_title:str) -> None:
        self.__data.update({ "date": time.strftime("%Y-%m-%d %H:%M:%S") })
        self.__data.update({ "id": str(uuid.uuid4()) })

        data_path = os.path.join(self.__data_folder, manga_title, "data.json")

        with open(data_path, "w", encoding="utf8") as f:
            json.dump(self.__data, f, ensure_ascii=False, indent=4)

    def scrap(self, updating=False) -> None:
        if not updating:
            self.__go_to_manga_page()
        else:
            self.__driver.get(self.__query)
            self.__driver.find_element(By.ID, "didomi-notice-agree-button").click()
            time.sleep(1)

            self.__data.update({ "link": self.__query })

        manga_title = self.__scrap_manga_title()
        self.__scrap_manga_infos()

        self.__driver.get(self.__first_page)
        time.sleep(1)

        navigation_links = self.__scrap_manga_volumes()

        self.__scrap_manga_volumes_img(navigation_links)

        self.__write_data(manga_title)
        self.__driver.quit()

        scrap_img = ScrapIMGNautiljon(self.__data, manga_title)
        scrap_img.scrap()


class ScrapIMGNautiljon:
    def __init__(self, data:dict, manga_title:str) -> None:
        self.__data = data
        self.__manga_title = manga_title

        self.__data_folder = "./data"

        folder_path = self.__get_folder_path()
        if not folder_path:
            raise ScrapNautiljonException("Manga folder not found")

        self.__img_folder_path = os.path.join(folder_path, "images")

        if not os.path.exists(self.__img_folder_path):
            os.makedirs(self.__img_folder_path)

    def __get_folder_path(self) -> str:
        folders = os.listdir(self.__data_folder)
        folder_path: str = ""

        for folder in folders:
            if re.search(self.__manga_title, folder, re.IGNORECASE):
                folder_path = os.path.join(self.__data_folder, folder)
                break

        return folder_path

    def __download_img(self, img_src:str, volume:str) -> None:
        headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
                AppleWebKit/537.36 (KHTML, like Gecko) \
                Chrome/58.0.3029.110 Safari/537.3",
        }

        response = requests.get(
            img_src,
            headers=headers,
            stream=True,
            timeout=5
        )
        img_name = f"{volume}.jpg"
        img_path = os.path.join(self.__img_folder_path, img_name)

        with open(img_path, "wb") as f:
            f.write(response.content)

    def scrap(self) -> None:
        nb_images = len(os.listdir(self.__img_folder_path))
        volumes = self.__data["volumes"]

        if nb_images < len(volumes):
            for volume in volumes:
                img_src = volumes[volume]["img_src"]
                self.__download_img(img_src, volume)


if __name__ == "__main__":
    # Arifureta (De zéro à héros) need spec (anime first and not manga on second)
    # reincarned in sword => same (anime first)
    # kuma kumu kuma bear => same (anime first)

    scrap = ScrapMangaNautiljon("kuma kuma kuma", debug=True)
    
    # scrap = ScrapMangaNautiljon("moi, quand je me réincarne en slime", debug=True)
    # scrap = ScrapMangaNautiljon("legende vivante", debug=False)
    # scrap = ScrapMangaNautiljon("sexy cosplay doll", debug=False)
    # scrap = ScrapMangaNautiljon("Fun Territory", debug=False)
    # scrap = ScrapMangaNautiljon("rising shield", debug=False)
    # scrap = ScrapMangaNautiljon("demon slave", debug=False)
    # scrap = ScrapMangaNautiljon("dungeon harem", debug=False)
    # scrap = ScrapMangaNautiljon("cave king", debug=False)
    # scrap = ScrapMangaNautiljon("dr stone", debug=False)
    # scrap = ScrapMangaNautiljon("noble adventure", debug=False)
    # scrap = ScrapMangaNautiljon("chilling in another", debug=False)

    scrap.scrap()
