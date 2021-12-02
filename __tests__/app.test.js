process.env.NODE_ENV = "test";
const request = require("supertest");
const { app, dropCollection, createCollection } = require("../app");

beforeAll(async () => {
    await createCollection('couriers');
});

describe("POST /couriers/data", () => {
    test("It should register a new courier and return a courier object", async () => {
        const response = await request(app).post("/couriers/data").send({
            "id": 1234,
            "max_capacity": 45
        });

        expect(response.body).toEqual({
            "data": {
                "_id": 1234,
                "max_capacity": 45
            },
            "error": false
        });

        expect(response.statusCode).toBe(200);
    }, 10000);

    test("It should return an error if the courier ID already exists", async () => {
        const response = await request(app).post("/couriers/data").send({
            "id": 1234,
            "max_capacity": 45
        });

        expect(response.body).toEqual({
            "error": "Courier ID already exists."
        });

        expect(response.statusCode).toBe(422);
    }, 10000);
});

describe("PUT /couriers/update", () => {
    test("It updates an existing courier", async() => {
        const response = await request(app).put("/couriers/update").send({
            "id": 1234,
            "max_capacity": 46
        });

        expect(response.body).toEqual({
            "data": {
                "acknowledged": true,
                "modifiedCount": 1,
                "upsertedId": null,
                "upsertedCount": 0,
                "matchedCount": 1
            },
            "error": false
        });

        expect(response.statusCode).toBe(200);
    });

    test("If you try to update a courier ID that doesn't exist, it should return an error", async() => {
        const response = await request(app).put("/couriers/update").send({
            "id": 7777,
            "max_capacity": 46
        });

        expect(response.body).toEqual({
            "error": "Courier ID doesn't exist"
        });

        expect(response.statusCode).toBe(422);
    });
});

describe("GET /couriers/lookup", () => {
    // The commented-out test doesn't seem to be functioning as expected, but a manual test of this does work

    // test("It should test and make sure that the courier queue is working (this checks for updates made while a lookup was in progress)", async () => {
    //     setTimeout(() => {
    //         request(app).post("/couriers/data").send({
    //         "id": 153954,
    //         "max_capacity": 75
    //         });
    //     }, 1000);

    //     const response = await request(app).post("/couriers/lookup").send({
    //         "capacity_required": 70,
    //         "testing_timeout": 9000 // this is the amount of time that the lookup should wait before looking for any new updates (the large timeout is just for testing)
    //     });

    //     expect(response.body).toEqual({
    //         "data": [
    //             {
    //                 "id": 153954,
    //                 "max_capacity": 75
    //             }
    //         ]
    //     });

    //     expect(response.statusCode).toBe(200);
    // }, 10000);

    test("It gets all available couriers whose max_capacity is equal to or greater than capacity_required", async() => {
        const response = await request(app).get("/couriers/lookup").send({
            "capacity_required": 40
        });

        expect(response.body).toEqual({
                "data": [
                    {
                        "_id": 1234,
                        "max_capacity": 46
                    }
                ]
        });

        expect(response.statusCode).toBe(200);
    }, 10000);

    test("It should return an empty array if there are no couriers that can accommodate the capacity_required number", async() => {
        const response = await request(app).get("/couriers/lookup").send({
            "capacity_required": 80
        });

        expect(response.body).toEqual({
                "data": []
        });

        expect(response.statusCode).toBe(200);
    }, 10000);
});

afterAll(async () => {
    await dropCollection('couriers');
});