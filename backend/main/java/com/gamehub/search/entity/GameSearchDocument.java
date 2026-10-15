package com.gamehub.search.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "gamehub_games", createIndex = true)
public class GameSearchDocument {
    @Id
    private Long id;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String name;
    @Field(type = FieldType.Keyword)
    private String nameSort;
    @Field(type = FieldType.Text)
    private String englishName;
    @Field(type = FieldType.Text)
    private String aliases;
    @Field(type = FieldType.Text)
    private String summary;
    @Field(type = FieldType.Keyword)
    private String slug;
    @Field(type = FieldType.Keyword)
    private String category;
    @Field(type = FieldType.Keyword)
    private List<String> tags;
    @Field(type = FieldType.Keyword)
    private List<String> platforms;
    @Field(type = FieldType.Keyword)
    private List<String> languages;
    @Field(type = FieldType.Keyword)
    private String coverUrl;
    @Field(type = FieldType.Long)
    private Long updatedAtEpoch;
    @Field(type = FieldType.Long)
    private Long publishedAtEpoch;
    @Field(type = FieldType.Long)
    private Long viewCount;
    @Field(type = FieldType.Long)
    private Long resourceClickCount;
}
