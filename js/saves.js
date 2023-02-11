const fs = typeof require !== 'undefined' ? require('fs') : null;

/**
 * Utility function for file reading
 * @param {string} file - file name
 * @return {string}
 */
function read_file(file) {
    let result = '';
    try {
        result = fs.readFileSync(file, 'utf8');
    } catch (err) {
        return '';
    }
    return result;
}

/**
 * Utility function for sorting array of objects
 * @param {string} property - property name
 * @return {function}
 */
function dynamicSort(property) {
    let sortOrder = 1;
    if (property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a, b) {
        const result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

/**
 * Convert timestamp to YYYY/MM/DD hh:mm:ss
 * @param {number} timestamp - unix timestamp
 * @return {string}
 */
function timestamp_to_date(timestamp) {
    const dt = new Date(timestamp);

    const year = dt.getFullYear();
    const month = "0" + (dt.getMonth() + 1);
    const day = "0" + dt.getDate();
    const date = year + '/' + month.substr(-2) + '/' + day.substr(-2);

    const hours = dt.getHours();
    const minutes = "0" + dt.getMinutes();
    const seconds = "0" + dt.getSeconds();
    const time = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

    return date + ' ' + time;
}

/**
 * Return all save files
 * @return {array}
 */
export function get_saves() {
    let result = [];
    if (fs) {
        fs.readdirSync('saves').forEach(file => {
            if (/^\d{13}\.tsf$/.test(file)) {
                const ts = parseInt(file.substring(0, file.length - 4));
                result.push({
                    name: timestamp_to_date(ts),
                    timestamp: ts,
                    data: read_file('saves/' + file),
                });
            }
        });
    } else if (localStorage) {
        for (const [key, value] of Object.entries(localStorage)) {
            if (/^\d{13}$/.test(key)) {
                const ts = parseInt(key);
                result.push({
                    name: timestamp_to_date(ts),
                    timestamp: ts,
                    data: value,
                });
            }
        }
    }
    result.sort(dynamicSort('-timestamp'));
    return result;
}

/**
 * Add or rewrite save-slot
 * @param {number} timestamp - it will be file name
 * @param {string} json_data - file data
 * @return {boolean}
 */
export function store_save(timestamp, json_data) {
    if (fs) {
        try {
            fs.writeFileSync('saves/' + timestamp + '.tsf', json_data);
        } catch (err) {
            return false;
        }
        return true;
    }
    if (localStorage) {
        localStorage.setItem(timestamp.toString(), json_data);
        return true;
    }
    return false;
}

/**
 * Delete save-slot
 * @param {number} timestamp - which file delete
 * @return {boolean}
 */
export function delete_save(timestamp) {
    if (fs) {
        try {
            fs.unlinkSync('saves/' + timestamp + '.tsf');
        } catch (err) {
            return false;
        }
        return true;
    }
    if (localStorage) {
        localStorage.removeItem(timestamp.toString());
        return true;
    }
    return false;
}
