package com.gamehub;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@MapperScan(basePackages = "com.gamehub", annotationClass = org.apache.ibatis.annotations.Mapper.class)
@SpringBootApplication
public class GameHubApplication {
    public static void main(String[] args) { SpringApplication.run(GameHubApplication.class, args); }
}
