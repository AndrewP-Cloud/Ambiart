import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv } from "../src/csv.js";
import { createNgaClient } from "../src/nga.js";

const imagesCsv = `uuid,iiifurl,iiifthumburl,viewtype,sequence,width,height,maxpixels,openaccess,depictstmsobjectid,assistivetext
img-a,https://api.nga.gov/iiif/a,"https://api.nga.gov/iiif/a/full/!200,200/0/default.jpg",primary,0,3840,2160,,1,1,"Blue, green, and red abstract painting"
img-b,https://api.nga.gov/iiif/b,"https://api.nga.gov/iiif/b/full/!200,200/0/default.jpg",primary,0,2160,3840,,1,2,Portrait study
img-c,https://api.nga.gov/iiif/c,"https://api.nga.gov/iiif/c/full/!200,200/0/default.jpg",primary,0,4000,2500,,1,3,"Landscape painting with a woman and parasol"
`;

const objectsCsv = `objectid,title,displaydate,medium,attribution,classification,subclassification,visualbrowserclassification,accessionnum
1,"Blue, Green, and Red",1964,Acrylic on canvas,Alma Thomas,Painting,Abstract,painting,1970.1.1
2,Portrait Study,1902,Graphite,Unknown Artist,Drawing,Portrait,drawing,1902.2.2
3,Woman with a Parasol,1875,Oil on canvas,Claude Monet,Painting,Impressionist,painting,1983.1.29
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

test("returns available NGA filter options", async () => {
  const client = createNgaClient({ fetchImpl: mockNgaFetch });
  const options = await client.options();

  assert.deepEqual(options.artists, ["Alma Thomas", "Claude Monet", "Unknown Artist"]);
  assert.deepEqual(options.categories, ["abstract", "drawing", "impressionist", "painting", "portrait"]);
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
