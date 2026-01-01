function load(entity, type) {
	if (__main_params__.appinfo.android) return new Promise(async (res, rej) => {
		let result = __main_params__.fetch(entity, type);
		res(result);
	});
	return new Promise(async (res, rej) => {
		__main_params__.database.read("assets", entity, async (read) => {
			let result = null;
			if (typeof read === "undefined") {
				try {
				result = await __main_params__.fetch(entity, type);
				
					__main_params__.database.write("assets", entity, result);
				} catch (e) {

				}
				////console.log(entity)
			} else {
				////console.log(read);
				result = read.value;
			}
			
			res(result);
		});
	});


}

function loadImage(directory, isImgElem) {
	if (__main_params__.appinfo.android) return new Promise(async (res, rej) => {
		try{
		let result = await __main_params__.fetch(directory, "blob");
		////console.log(result)
		let img = new Image();
		img.src = URL.createObjectURL(result);
		//////console.log(img.src)
		img.onload = () => {
			URL.revokeObjectURL(result);
			res(img);
		}
		} catch(e) {
			//console.log(e.stack)
		}
		//res(result)
	});
	return new Promise((res, rej) => {

		__main_params__.database.read("assets", directory, async (read) => {
			let result = {};
			//////console.log(directory)
			if (typeof read === "undefined") {
				result = await __main_params__.fetch(directory, "blob");
				////console.log(directory)
				try {
					__main_params__.database.write("assets", directory, result);
				} catch (e) {

				}


			} else {
				////console.log(read)
				result = read.value;
			}
			
			/*let img = new Image();
			img.src = URL.createObjectURL(new Blob([result]));
			//////console.log(img.src)
			img.onload = () => {
				URL.revokeObjectURL(img.src);
				if (isImgElem) {
					res(img);
					return;
				}
				
			img = null
			
			
			
			}/**/
			let bmp = createImageBitmap(result);
			res(bmp);
			
			
		});


	});
}
/**/

__main_params__.__private.loadImage = loadImage;
__main_params__.__private.load = load;