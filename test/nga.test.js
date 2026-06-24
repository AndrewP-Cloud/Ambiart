import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv } from "../src/csv.js";
import { createNgaClient } from "../src/nga.js";

const imagesCsv = `uuid,iiifurl,iiifthumburl,viewtype,sequence,width,height,maxpixels,openaccess,depictstmsobjectid,assistivetext
img-a,https://api.nga.gov/iiif/a,"https://api.nga.gov/iiif/a/full/!200,200/0/default.jpg",primary,0,3840,2160,,1,1,"Blue, green, and red abstract painting"
img-b,https://api.nga.gov/iiif/b,"https://api.nga.gov/iiif/b/full/!200,200/0/default.jpg",primary,0,2160,3840,,1,2,Portrait study
img-c,https://api.nga.gov/iiif/c,"https://api.nga.gov/iiif/c/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,3,"Landscape painting with a woman and parasol"
img-d,https://api.nga.gov/iiif/d,"https://api.nga.gov/iiif/d/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,4,"Landscape painting"
img-e,https://api.nga.gov/iiif/e,"https://api.nga.gov/iiif/e/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,5,"Landscape painting"
img-f,https://api.nga.gov/iiif/f,"https://api.nga.gov/iiif/f/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,6,"Landscape painting"
img-g,https://api.nga.gov/iiif/g,"https://api.nga.gov/iiif/g/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,7,"Landscape painting"
img-h,https://api.nga.gov/iiif/h,"https://api.nga.gov/iiif/h/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,8,"Landscape painting"
img-i,https://api.nga.gov/iiif/i,"https://api.nga.gov/iiif/i/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,9,"Landscape painting"
img-j,https://api.nga.gov/iiif/j,"https://api.nga.gov/iiif/j/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,10,"Landscape painting"
img-k,https://api.nga.gov/iiif/k,"https://api.nga.gov/iiif/k/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,11,"Landscape painting"
img-l,https://api.nga.gov/iiif/l,"https://api.nga.gov/iiif/l/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,12,"Landscape painting"
img-m,https://api.nga.gov/iiif/m,"https://api.nga.gov/iiif/m/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,13,"Landscape painting"
`;

const objectsCsv = `objectid,title,displaydate,medium,attribution,classification,subclassification,visualbrowserclassification,accessionnum
1,"Blue, Green, and Red",1964,Acrylic on canvas,Alma Thomas,Painting,Abstract,painting,1970.1.1
2,Portrait Study,1902,Graphite,Unknown Artist,Drawing,Portrait,drawing,1902.2.2
3,Woman with a Parasol,1875,Oil on canvas,Claude Monet,Painting,Impressionist,painting,1983.1.29
4,Painting Four,1904,Oil on canvas,Pool Artist,Painting,Landscape,painting,1904.1
5,Painting Five,1905,Oil on canvas,Pool Artist,Painting,Landscape,painting,1905.1
6,Painting Six,1906,Oil on canvas,Pool Artist,Painting,Landscape,painting,1906.1
7,Painting Seven,1907,Oil on canvas,Pool Artist,Painting,Landscape,painting,1907.1
8,Painting Eight,1908,Oil on canvas,Pool Artist,Painting,Landscape,painting,1908.1
9,Painting Nine,1909,Oil on canvas,Pool Artist,Painting,Landscape,painting,1909.1
10,Painting Ten,1910,Oil on canvas,Pool Artist,Painting,Landscape,painting,1910.1
11,Painting Eleven,1911,Oil on canvas,Pool Artist,Painting,Landscape,painting,1911.1
12,Painting Twelve,1912,Oil on canvas,Pool Artist,Painting,Landscape,painting,1912.1
13,Painting Thirteen,1913,Oil on canvas,Pool Artist,Painting,Landscape,painting,1913.1
`;

test("parses quoted CSV fields", () => {
  const rows = parseCsv(`id,title
1,"Blue, Green, and Red"
`);

  assert.equal(rows[0].title, "Blue, Green, and Red");
});

test("maps NGA CSV rows into Ambiart wallpapers", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch });
  const wallpapers = await client.list({ category: "painting", artist: "Alma Thomas" });

  assert.equal(wallpapers.length, 1);
  assert.equal(wallpapers[0].id, "nga-1-img-a");
  assert.equal(wallpapers[0].title, "Blue, Green, and Red");
  assert.equal(wallpapers[0].artist, "Alma Thomas");
  assert.equal(wallpapers[0].category, "painting");
  assert.equal(wallpapers[0].source, "national-gallery-of-art");
  assert.equal(wallpapers[0].orientation, "landscape");
  assert.equal(wallpapers[0].imageUrl, "https://api.nga.gov/iiif/a/full/!3840,3840/0/default.jpg");
  assert.equal(wallpapers[0].metadata.medium, "Acrylic on canvas");
  assert.equal(wallpapers[0].metadata.assistiveText, "Blue, green, and red abstract painting");
});

test("supports searching and random NGA wallpapers", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch });
  const found = await client.list({ q: "portrait" });
  const random = await client.random({ orientation: "portrait" }, () => 0);

  assert.equal(found[0].sourceObjectId, "2");
  assert.equal(random.id, "nga-2-img-b");
});

test("finds artist matches outside the shallow image cache", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch, scanLimit: 1 });
  const wallpapers = await client.list({ artist: "Claude Monet", limit: 1 });

  assert.equal(wallpapers.length, 1);
  assert.equal(wallpapers[0].id, "nga-3-img-c");
  assert.equal(wallpapers[0].artist, "Claude Monet");
});

test("finds wallpaper by id outside the shallow image cache", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch, scanLimit: 1 });
  const wallpaper = await client.getById("nga-3-img-c");

  assert.equal(wallpaper.title, "Woman with a Parasol");
});

test("rotates through two random cache sets before refreshing", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch, randomPoolSize: 5 });
  const ids = [];

  for (let index = 0; index < 12; index += 1) {
    const wallpaper = await client.random({ artist: "Pool Artist" }, () => 0);
    ids.push(wallpaper.id);
  }

  assert.equal(new Set(ids.slice(0, 5)).size, 5);
  assert.equal(new Set(ids.slice(5, 10)).size, 5);
  assert.equal(ids.slice(0, 5).some((id) => ids.slice(5, 10).includes(id)), false);
  assert.equal(ids.slice(5, 10).includes(ids[10]), false);
  assert.equal(ids.slice(5, 10).includes(ids[11]), false);
});

test("returns available NGA filter options", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch });
  const options = await client.options();

  assert.deepEqual(options.artists, ["Alma Thomas", "Claude Monet", "Pool Artist", "Unknown Artist"]);
  assert.deepEqual(options.categories, ["abstract", "drawing", "impressionist", "landscape", "painting", "portrait"]);
  assert.deepEqual(options.orientations, ["landscape", "portrait"]);
  assert.equal(options.sourceFields.artist, "objects.csv attribution");
});

function mockNgaFetch(url) {
  const body = String(url).includes("objects.csv") ? objectsCsv : imagesCsv;

  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body)
  });
}
