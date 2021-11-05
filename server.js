const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(cors());

app.get('/colors', async(req, res) => {
	const uri = process.env.MONGODB_URI;
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = client.db("moduscreate").collection("moduscreate");
			const colors = await collection.find({}).toArray();

			client.close();

			await res.json({'data': colors});
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.post('/color', async(req, res) => {
	const { body } = req;

	const { hex, name: colorName } = body;


	const uri = process.env.MONGODB_URI;
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = client.db("moduscreate").collection("moduscreate");
			const newColor = { hex: hex.toUpperCase(), name: colorName.toLowerCase() };

			const foundColor = await collection.findOne({ name: colorName.toLowerCase() });

			if (!foundColor) {			
				// insert new color into the collection
				collection.insertOne(newColor, (collectionError, collectionRes) => {
					if (collectionError) {
						client.close();

						throw collectionError;
					}

					client.close();

					res.json({'data': {'_id': collectionRes.insertedId, ...newColor }, 'error': false});
				});
			} else {
				client.close();

				await res.status(422).json({'error': 'Color name already exists.'});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.put('/color', async(req, res) => {
	const { body } = req;

	const { hex, name: colorName } = body;


	const uri = process.env.MONGODB_URI;
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = client.db("moduscreate").collection("moduscreate");
			const newColor = { hex: hex.toUpperCase(), name: colorName.toLowerCase() };

			const foundColor = await collection.findOne({ name: colorName.toLowerCase() });

			if (foundColor) {			
				// update color
				const q = { name: colorName.toLowerCase() };
				const updatedDocument = { $set: { name: colorName.toLowerCase(), hex: hex.toUpperCase() }};

				collection.updateOne(q, updatedDocument, (collectionError, collectionRes) => {
					if (collectionError) {
						client.close();

						throw collectionError;
					}

					client.close();
					
					res.json({'data': collectionRes, 'error': false});
				})
			} else {
				client.close();

				await res.status(422).json({'error': 'Color doesn\'t exist'});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.delete('/color', async(req, res) => {
	const { body } = req;

	const { name: colorName } = body;


	const uri = process.env.MONGODB_URI;
	const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

	try {
		client.connect(async (err) => {
			if (err) throw err;

			const collection = client.db("moduscreate").collection("moduscreate");

			const foundColor = await collection.findOne({ name: colorName.toLowerCase() });

			if (foundColor) {			
				// delete color
				const q = { name: colorName.toLowerCase() };

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

				await res.status(422).json({'error': 'Color doesn\'t exist'});
			}
		});
	} catch (e) {
		client.close();

		res.status(500).json({'error': e});
	}
});

app.post('/access_token', async(req, res) => {
	const { query } = req;
	const { shop, code, hmac, host, state, timestamp } = query;

	const verifyShopName = () => {
		const regexp = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/g;
	
		if (shop.match(regexp))
		  return true;
	
		return false;
	}
	
	const verifyHMAC = async() => {
		const hashFunc = createSHA256();
		const hmacCreator = await createHMAC(hashFunc, process.env.SHOPIFY_SECRET_KEY);
		let variables = [];
		if (code) {
		  variables.push(`code=${code}`);
		}
		if (host) {
		  variables.push(`host=${host}`);
		}
		if (shop) {
		  variables.push(`shop=${shop}`);
		}
		if (state) {
		  variables.push(`state=${state}`);
		}
		if (timestamp) {
		  variables.push(`timestamp=${timestamp}`);
		}
	
		if (variables.length) {
		  variables = variables.join('&');
		} else {
		  return false;
		}
	
		hmacCreator.init();
		hmacCreator.update(variables);
	
		const digest = hmacCreator.digest();
	
		if (digest === hmac) 
		  return true;
		  
		return false;
	}
	
	const verifyState = () => {
		if (state) {
		  if (state === localStorage.getItem('state')) {
			return true;
		  }
		  return false;
		}
	
		// sometimes we may not have the state query param, such as in the case of installing this app on a dev store
		// in this case, return true
		return true;
	}

	if (verifyShopName() && await verifyHMAC() && verifyState()) {
	 	await axios.post(`https://${shop}/admin/oauth/access_token`, {
			code: code,
			client_id: process.env.SHOPIFY_CLIENT_ID,
			client_secret: process.env.SHOPIFY_SECRET_KEY
		})
		.then((response) => {
			const uri = process.env.MONGODB_URI;
			const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
			client.connect(async (err) => {
				if (err) throw err;

				const collection = client.db("cogsy").collection("stores");
				const foundStore = await collection.findOne({}, { name: shop });

				if (response && response.data && response.data.access_token) {
					if (foundStore) {
						const q = { shop: shop };
						const updatedDocument = { $set: { shop: shop, access_token: response.data.access_token }};

						// update existing store with new access token
						collection.updateOne(q, updatedDocument, (collectionError, collectionRes) => {
							if (collectionError) {
								client.close();

								throw collectionError;
							}

							client.close();
							
							res.json({'data': response.data, 'error': false});
						})
					} else {
						const newStore = {shop: shop, access_token: response.data.access_token};
						
						// insert new store into the collection
						collection.insertOne(newStore, (collectionError, collectionRes) => {
							if (collectionError) {
								client.close();

								throw collectionError;
							}

							client.close();

							res.json({'data': response.data, 'error': false});
						});
					}
				} else {
					client.close();
					await res.json({'error': 'Failed to obtain access token from Shopify'});
				}
			});

		}, (error) => {
			res.json({'error': error});
		});
	} else {
		await res.json({'error': 'Missing shop or code parameter'});
	}
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Example app is listening on port ${port}`));
