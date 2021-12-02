const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(cors());

const mongo_uri = process.env.MONGODB_URI;
const client = new MongoClient(mongo_uri, { useNewUrlParser: true, useUnifiedTopology: true });
const requestedCapacities = {};

const connectToCollection = (collectionName) => {
	const collection = client.db(process.env.DB_NAME).collection(collectionName);

	return collection;
};

const dropCollection = (collectionName) => {
    client.connect(async (err) => {
        client.db(process.env.DB_NAME).collection(collectionName).drop();
        client.db(process.env.DB_NAME).dropDatabase();
    });

    client.close();
}

const createCollection = (collectionName, options) => {
    client.connect(async (err) => {
        client.db(process.env.DB_NAME);
        client.db(process.env.DB_NAME).createCollection(collectionName, options);
    });

    client.close();
}

app.get('/couriers/lookup', async(req, res) => {
	const { body } = req;
	const { capacity_required, testing_timeout } = body;

	const currentTimestamp = new Date().getTime();

	try {
		if (!requestedCapacities[capacity_required]) {
			requestedCapacities[capacity_required] = {
				lookupRequests: 1,
				couriers: []
			}
		} else {
			requestedCapacities[capacity_required].lookupRequests = requestedCapacities[capacity_required].lookupRequests + 1;
		}
	} catch(e) {
		client.close();

		res.status(500).json({'error': 'capacity_required should be a number greater than -1'});
	}

	try {
		client.connect(async (err) => {
			if (err) throw err;

			let collection = connectToCollection('couriers');
			let couriers = await collection.find({ max_capacity: { $gte: capacity_required }}).toArray();

			client.close();

			setTimeout(async() => {
				client.connect(async (err) => {
					if (requestedCapacities[capacity_required].couriers.length > 0) {
						// if this is more than 0, it means that there are new courier updates which meet our capacity requirement
						const newMatches = requestedCapacities[capacity_required].couriers;

						// collection = connectToCollection('couriers');
						// const additionalCouriers = await collection.find({ _id: {$in: ids}}).toArray();

						if (newMatches.length) {
							couriers = couriers.concat(newMatches);
						}
					}

					requestedCapacities[capacity_required].lookupRequests = requestedCapacities[capacity_required].lookupRequests - 1;
					
					if (requestedCapacities[capacity_required].lookupRequests === 0) {
						// make sure we don't delete the requested capacity array for any other lookup requests
						// if there aren't any other lookup requests, go ahead and reset it
						requestedCapacities[capacity_required].couriers = [];
					}

					client.close();

					await res.json({'data': couriers});
				});
			}, testing_timeout || 0);
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.put('/couriers/update', async(req, res) => {
	const { body } = req;
	const { id, max_capacity } = body;
	let foundCourier;

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = connectToCollection('couriers');

			if (id) {
				foundCourier = await collection.findOne({ _id: id });
			}

			if (foundCourier) {			
				// update courier
				const q = { _id: id };
				const updatedDocument = { $set: { max_capacity: max_capacity }};

				collection.updateOne(q, updatedDocument, (collectionError, collectionRes) => {
					if (collectionError) {
						client.close();

						throw collectionError;
					}

					client.close();

					for (const [capacityRequired, matchingCouriers] of Object.entries(requestedCapacities)) {
						if (capacityRequired <= max_capacity) {
							requestedCapacities[capacityRequired].couriers.push({
								id: id,
								max_capacity: max_capacity
							});
						}
					}				

					res.json({'data': collectionRes, 'error': false});
				})
			} else {
				client.close();

				await res.status(422).json({'error': 'Courier ID doesn\'t exist'});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.post('/couriers/data', async(req, res) => {
	const { body } = req;
	const { id, max_capacity } = body;
	let foundCourier;

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = connectToCollection('couriers');

			if (id) {
				foundCourier = await collection.findOne({ _id: id });
			}

			if (foundCourier) {			
				client.close();

				await res.status(422).json({'error': 'Courier ID already exists.'});
			} else {
				const newCourier = { _id: id, max_capacity: max_capacity };

				collection.insertOne(newCourier, (collectionError, collectionRes) => {
					if (collectionError) {
						client.close();

						throw collectionError;
					}

					client.close();

					for (const [capacityRequired, arrayOfCapacities] of Object.entries(requestedCapacities)) {
						if (capacityRequired <= max_capacity) {
							requestedCapacities[capacityRequired].couriers.push({
								id: id,
								max_capacity: max_capacity
							});
						}
					}	
					
					res.json({'data': {'_id': collectionRes.insertedId, ...newCourier }, 'error': false});
				});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.delete('/couriers/delete', async(req, res) => {
	const { body } = req;
	const { id } = body;

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = connectToCollection('couriers');

			const foundColor = await collection.findOne({ _id: id });

			if (foundColor) {			
				// delete courier
				const q = { _id: id };

				collection.deleteOne(q, (collectionError, collectionRes) => {
					if (collectionError) {
						client.close();

						throw collectionError;
					}

					client.close();
					
					res.json({'data': collectionRes, 'error': false});
				})
			} else {
				client.close();

				await res.status(422).json({'error': 'Courier ID doesn\'t exist'});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

exports.app = app;
exports.dropCollection = dropCollection;
exports.createCollection = createCollection;