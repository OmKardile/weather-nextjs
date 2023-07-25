import Image from "next/image";
import React from "react";
import { CiTempHigh, CiMapPin } from "react-icons/ci";

const Weather = ({ data }) => {

  return (
    <div className="relative flex flex-col justify-between max-w-[500px] w-full h-[90vh] m-auto p-4 text-gray-300 z-10">
      <div className="relative flex justify-between pt-12">
        <div className="flex flex-col items-center ">
          <Image
            src={`http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`}
            alt="/"
            width="100"
            height="100"
          />
          <p className="text-2xl">{data.weather[0].main}</p>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-row text-8xl max-sm:text-5xl max-sm:mt-5 items-center">
            <CiTempHigh className="text-8xl max-sm:text-6xl" />
            <p className="text-9xl max-sm:text-7xl">
              {data.main.temp.toFixed(0)}&#176;
            </p>
            C
          </div>
          <p className="text-3xl m-[-10px] sm:ml-16 max-sm:text-2xl max-sm:p-5">
            But Feels Like <i> {data.main.feels_like.toFixed(0)}&#176;C</i>
          </p>
        </div>
      </div>

      <div className="bg-black/50 relative p-8 rounded-md">
        <p className="text-2xl text-center pb-6">
          Weather in {data.name}, {data.sys.country} 
          {/* <br /><p className="text-xl">(As per Unix Time: {data.dt} )</p> */}
        </p>
        
        <div className="flex justify-between text-center pt-2">
          <div className="max-sm:p-2">
            <p className="text-xl">Humidity</p>
            <p className="font-bold text-2xl">{data.main.humidity}%</p>
          </div>
          <div className="max-sm:p-2">
            <p className="text-xl">Winds</p>
            <p className="font-bold text-2xl">
              {data.wind.speed.toFixed(0)} Kph
            </p>
          </div>
          <div className="max-sm:p-2">
            <p className="text-xl">Cloudiness</p>
            <p className="font-bold text-2xl">{data.clouds.all}% </p>
          </div>
        </div>

        <div className="flex justify-between text-center items-center pt-2">
          <div className="max-sm:p-3">
            <p className="text-xl">Pressure</p>
            <p className="font-bold text-2xl">{data.main.pressure} hPa</p>
          </div>
          <div className="max-sm:p-3">
            <p className="text-xl">Wind Direction</p>
            <p className="font-bold text-2xl">
              {data.wind.deg} Degrees
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Weather;
