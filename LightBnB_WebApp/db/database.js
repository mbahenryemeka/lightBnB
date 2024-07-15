const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require("pg");

const pool = new Pool({
  user: "labber",
  password: "labber",
  host: "localhost",
  database: "lightbnb",
});


/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1`, [email])
    .then((result) => {
      // Check if we have a result
      if (result.rows.length) {
        return result.rows[0]; // return the first row (user object)
      } else {
        return null; // no user found, return null
      }
    })
    .catch((err) => {
      console.error(err.message);
      throw err; // re-throw the error to be caught by the calling context
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1`, [id])
    .then((result) => {
      // Check if we have a result
      if (result.rows.length) {
        return result.rows[0]; // return the first row (user object)
      } else {
        return null; // no user found, return null
      }
    })
    .catch((err) => {
      console.error(err.message);
      throw err; // re-throw the error to be caught by the calling context
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  const { name, email, password } = user; // Destructure the user object 
  return pool
    .query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *;`,
      [name, email, password]
    )
    .then((result) => {
      return result.rows[0]; // return the newly inserted user
    })
    .catch((err) => {
      console.error(err.message);
      throw err; // re-throw the error to be caught by the calling context
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  const queryString = `
    SELECT reservations.id, properties.title, properties.cost_per_night, reservations.start_date, avg(rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2;
  `;

  // Execute the query
  return pool.query(queryString, [guest_id, limit])
    .then((result) => {
      // Return the result from the query
      return result.rows;
    })
    .catch((err) => {
      console.error('Query error:', err.message);
      throw err; // Re-throw the error to be caught by the calling context
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = (options, limit = 10) => {
  const queryParams = [];
  let queryString = `
    SELECT properties.*, avg(property_reviews.rating) as average_rating
    FROM properties
    JOIN property_reviews ON properties.id = property_id
    WHERE 1=1
  `;

  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += ` AND city LIKE $${queryParams.length} `;
  }

  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += ` AND owner_id = $${queryParams.length} `;
  }

  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    const minPrice = options.minimum_price_per_night * 100;
    const maxPrice = options.maximum_price_per_night * 100;
    queryParams.push(minPrice, maxPrice);
    queryString += ` AND cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length} `;
  } else {
    if (options.minimum_price_per_night) {
      const minPrice = options.minimum_price_per_night * 100;
      queryParams.push(minPrice);
      queryString += ` AND cost_per_night >= $${queryParams.length} `;
    }

    if (options.maximum_price_per_night) {
      const maxPrice = options.maximum_price_per_night * 100;
      queryParams.push(maxPrice);
      queryString += ` AND cost_per_night <= $${queryParams.length} `;
    }
  }

  queryString += ` GROUP BY properties.id `;

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` HAVING avg(property_reviews.rating) >= $${queryParams.length} `;
  }

  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  console.log(queryString, queryParams);

  return pool.query(queryString, queryParams).then((res) => res.rows);
};
/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
/*const addProperty = function (property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
};*/

const addProperty = async function(property) {
  const queryString = `
    INSERT INTO properties (
      owner_id, title, description, thumbnail_photo_url, 
      cover_photo_url, cost_per_night, street, city, 
      province, post_code, country, parking_spaces, 
      number_of_bathrooms, number_of_bedrooms)
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;
  
  const values = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ];
  
  try {
    const res = await pool.query(queryString, values);
    return res.rows[0];
  } catch (err) {
    console.error('Error adding property:', err);
    throw err;
  }
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
